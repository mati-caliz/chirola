import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Body de refresh y logout: el refresh token opaco entregado al iniciar sesión. */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResponse {
  /** Access token (JWT, corta duración). */
  token: string;
  /** Refresh token opaco (larga duración, rota en cada uso). */
  refreshToken: string;
  user: AuthUser;
}
