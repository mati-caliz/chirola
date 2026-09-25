import { type ReactNode } from "react";
import { useRouter } from "expo-router";
import type { IssueVoucher } from "@chirola/shared";
import { QueuedEmissionScreen } from "@/components/vouchers/QueuedEmissionScreen";
import { hasText } from "@chirola/shared";
import { EmittingScreen, FailedEmissionScreen } from "./EmissionStatusScreens";
import { useVoucherEmission } from "./use-voucher-emission";
import { useVoucherFormOptions } from "./use-voucher-form-options";
import { useVoucherFormState } from "./use-voucher-form-state";
import { VoucherFormBody } from "./VoucherFormBody";

export function VoucherForm({
  issuerId,
  draft,
}: Readonly<{
  issuerId: string;
  draft: IssueVoucher | null;
}>): ReactNode {
  const router = useRouter();
  const form = useVoucherFormState(draft);
  const options = useVoucherFormOptions({
    issuerId,
    draft,
    voucherType: form.values.voucherType,
    setVoucherType: form.setters.setVoucherType,
  });
  const emission = useVoucherEmission({ issuerId, draft, form });

  if (emission.queued) {
    return (
      <QueuedEmissionScreen
        onSeeVouchers={() => {
          router.replace("/(app)/(tabs)/comprobantes");
        }}
        onExit={() => {
          router.back();
        }}
      />
    );
  }
  if (emission.isEmitting) {
    return <EmittingScreen />;
  }
  if (hasText(emission.error)) {
    return (
      <FailedEmissionScreen
        message={emission.error}
        onRetry={emission.clearError}
        onExit={() => {
          router.back();
        }}
      />
    );
  }

  return (
    <VoucherFormBody issuerId={issuerId} draft={draft} form={form} options={options} emission={emission} />
  );
}
