export interface EmissionPlanVerification {
  onboardingStatus: string;
  confirmsIssuing: boolean;
  note: string;
}

export interface EmissionPlan {
  salesPoint: number;
  voucherType: number;
  number: number;
  netAmount: number;
  ivaAmount: number;
  totalAmount: number;
  rates: { id: number; taxableBase: number; amount: number }[];
  verification: EmissionPlanVerification;
}
