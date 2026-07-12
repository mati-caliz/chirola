import * as SecureStore from 'expo-secure-store';
import type { AuthResponse, AuthUser } from '@chirola/shared';
import { API_URL } from './config';

const ACCESS_KEY = 'chirola.accessToken';
const REFRESH_KEY = 'chirola.refreshToken';
const USER_KEY = 'chirola.user';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(cb: (() => void) | null): void {
  onUnauthorized = cb;
}

export async function loadSession(): Promise<AuthUser | null> {
  accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
  refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  const rawUser = await SecureStore.getItemAsync(USER_KEY);
  if (!accessToken || !rawUser) return null;
  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    return null;
  }
}

export function hasSession(): boolean {
  return accessToken != null;
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
  if (!refreshToken) return false;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as AuthResponse;
  await setSession(data);
  return true;
}

interface RawRequest {
  method?: string;
  body?: unknown;

  _retried?: boolean;
}

async function request(path: string, opts: RawRequest): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && !opts._retried && refreshToken) {
    if (await tryRefresh()) {
      return request(path, { ...opts, _retried: true });
    }

    await clearSession();
    onUnauthorized?.();
  }
  return res;
}

async function parseError(res: Response): Promise<never> {
  let message = `Error ${res.status}`;
  try {
    const data = await res.json();
    if (data?.message) {
      message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
  } catch {

  }
  throw new ApiError(res.status, message);
}

export async function apiFetch<T>(
  path: string,
  opts: RawRequest = {},
): Promise<T> {
  const res = await request(path, opts);
  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return btoa(binary);
}

export async function apiFetchBase64(path: string): Promise<string> {
  const res = await request(path, {});
  if (!res.ok) await parseError(res);
  return arrayBufferToBase64(await res.arrayBuffer());
}

export async function registerRequest(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password },
  });
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function logoutRequest(): Promise<void> {
  const token = refreshToken;
  if (!token) return;
  try {
    await apiFetch('/auth/logout', { method: 'POST', body: { refreshToken: token } });
  } catch {

  }
}
