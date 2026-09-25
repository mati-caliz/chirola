import { authResponseSchema, authUserSchema, hasText } from "@chirola/shared";
import * as SecureStore from "expo-secure-store";
import type { z } from "zod";
import type { AuthResponse, AuthUser } from "@chirola/shared";
import { API_URL } from "./config";

const ACCESS_KEY = "chirola.accessToken";
const REFRESH_KEY = "chirola.refreshToken";
const USER_KEY = "chirola.user";
const HTTP_UNAUTHORIZED = 401;
const HTTP_NO_CONTENT = 204;
const BASE64_CHUNK_SIZE = 0x8000;
const UNEXPECTED_RESPONSE_MESSAGE = "La respuesta del servidor no tiene el formato esperado.";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(cb: (() => void) | null): void {
  onUnauthorized = cb;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStoredUser(rawUser: string): AuthUser | null {
  try {
    const parsed = authUserSchema.safeParse(JSON.parse(rawUser));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function loadSession(): Promise<AuthUser | null> {
  accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
  refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  const rawUser = await SecureStore.getItemAsync(USER_KEY);
  if (!hasText(accessToken) || !hasText(rawUser)) return null;
  return parseStoredUser(rawUser);
}

export function hasSession(): boolean {
  return accessToken !== null;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export async function setSession(res: AuthResponse): Promise<void> {
  accessToken = res.token;
  refreshToken = res.refreshToken;
  await SecureStore.setItemAsync(ACCESS_KEY, res.token);
  await SecureStore.setItemAsync(REFRESH_KEY, res.refreshToken);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(res.user));
}

export async function clearSession(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

async function tryRefresh(): Promise<boolean> {
  if (!hasText(refreshToken)) return false;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const parsed = authResponseSchema.safeParse(await res.json());
  if (!parsed.success) return false;
  await setSession(parsed.data);
  return true;
}

interface RawRequest {
  method?: string;
  body?: unknown;

  _retried?: boolean;
}

async function request(path: string, opts: RawRequest): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (hasText(accessToken)) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    ...(opts.body !== undefined && { body: JSON.stringify(opts.body) }),
  });

  if (res.status === HTTP_UNAUTHORIZED && opts._retried !== true && hasText(refreshToken)) {
    if (await tryRefresh()) {
      return await request(path, { ...opts, _retried: true });
    }

    await clearSession();
    onUnauthorized?.();
  }
  return res;
}

function extractErrorMessage(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const message = data["message"];
  if (Array.isArray(message)) return message.join(", ");
  if (typeof message === "string" && message !== "") return message;
  return null;
}

async function parseError(res: Response): Promise<never> {
  const data: unknown = await res.json().catch(() => null);
  const message = extractErrorMessage(data) ?? `Error ${res.status}`;
  throw new ApiError(res.status, message);
}

async function readJsonBody(res: Response): Promise<unknown> {
  return res.status === HTTP_NO_CONTENT ? undefined : await res.json();
}

type ResponseSchema<Output> = z.ZodType<Output, z.ZodTypeDef, unknown>;

function parseResponseBody<Output>(schema: ResponseSchema<Output>, body: unknown, status: number): Output {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(status, UNEXPECTED_RESPONSE_MESSAGE);
  }
  return parsed.data;
}

export async function apiFetch<Output>(
  path: string,
  schema: ResponseSchema<Output>,
  opts: RawRequest = {},
): Promise<Output> {
  const res = await request(path, opts);
  if (!res.ok) await parseError(res);
  return parseResponseBody(schema, await readJsonBody(res), res.status);
}

export async function apiSend(path: string, opts: RawRequest = {}): Promise<void> {
  const res = await request(path, opts);
  if (!res.ok) await parseError(res);
  await readJsonBody(res);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE));
  }

  return btoa(binary);
}

export async function apiFetchBase64(path: string): Promise<string> {
  const res = await request(path, {});
  if (!res.ok) await parseError(res);
  return arrayBufferToBase64(await res.arrayBuffer());
}

export async function registerRequest(email: string, password: string): Promise<AuthResponse> {
  return await apiFetch("/auth/register", authResponseSchema, {
    method: "POST",
    body: { email, password },
  });
}

export async function loginRequest(email: string, password: string): Promise<AuthResponse> {
  return await apiFetch("/auth/login", authResponseSchema, {
    method: "POST",
    body: { email, password },
  });
}

export async function logoutRequest(): Promise<void> {
  const token = refreshToken;
  if (!hasText(token)) return;
  await apiSend("/auth/logout", { method: "POST", body: { refreshToken: token } }).catch(() => undefined);
}
