import { z } from 'zod';

export const PushPlatform = {
  IOS: 'ios',
  ANDROID: 'android',
} as const;

export const pushTokenSchema = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[.+\]$/, 'Token de push inválido'),
  platform: z.enum([PushPlatform.IOS, PushPlatform.ANDROID]),
});

export type PushTokenInput = z.infer<typeof pushTokenSchema>;

export const removePushTokenSchema = pushTokenSchema.pick({ token: true });

export type RemovePushTokenInput = z.infer<typeof removePushTokenSchema>;
