const DEFAULT_API_URL = "http://localhost:3000/api";
const configuredApiUrl: unknown = process.env["EXPO_PUBLIC_API_URL"] ?? DEFAULT_API_URL;

export const API_URL = typeof configuredApiUrl === "string" ? configuredApiUrl : DEFAULT_API_URL;
