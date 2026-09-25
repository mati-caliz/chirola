import { z } from "zod";

export const emissionPlanVerificationSchema = z.object({
  onboardingStatus: z.string(),
  confirmsIssuing: z.boolean(),
  note: z.string(),
});

export type EmissionPlanVerification = z.infer<typeof emissionPlanVerificationSchema>;

export const emissionPlanSchema = z.object({
  salesPoint: z.number(),
  voucherType: z.number(),
  number: z.number(),
  netAmount: z.number(),
  ivaAmount: z.number(),
  totalAmount: z.number(),
  rates: z.array(z.object({ id: z.number(), taxableBase: z.number(), amount: z.number() })),
  verification: emissionPlanVerificationSchema,
});

export type EmissionPlan = z.infer<typeof emissionPlanSchema>;
