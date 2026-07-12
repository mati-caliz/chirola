/**
 * URL base de la API. En dev con un dispositivo real, `localhost` no resuelve al
 * backend de tu máquina: definí `EXPO_PUBLIC_API_URL` (p. ej. http://192.168.0.10:3000/api)
 * en un `.env` o al lanzar Expo. El prefijo `/api` lo fija `main.ts` del backend.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';
