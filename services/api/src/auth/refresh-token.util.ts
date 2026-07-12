import { createHash, randomBytes } from 'node:crypto';

/** Genera un refresh token opaco (base64url, 32 bytes de entropía). */
export function generarRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash del token para guardarlo at-rest. SHA-256 alcanza porque el token ya es
 * aleatorio de alta entropía (no es una contraseña adivinable).
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
