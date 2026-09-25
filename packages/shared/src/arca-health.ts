import { z } from "zod";

export const arcaHealthSchema = z.object({
  environment: z.string(),
  appServer: z.boolean(),
  dbServer: z.boolean(),
  authServer: z.boolean(),
  available: z.boolean(),
  checkedAt: z.string(),
});

export type ArcaHealth = z.infer<typeof arcaHealthSchema>;
