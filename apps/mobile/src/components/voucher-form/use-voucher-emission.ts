import { useState } from "react";
import { useRouter } from "expo-router";
import type { ZodError } from "zod";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import {
  LOCAL_CURRENCY,
  LOCAL_EXCHANGE_RATE,
  type EmissionPlan,
  type IssueVoucher,
  type IssuedVoucher,
} from "@chirola/shared";
import { pendingVouchersQueryKey } from "@/components/vouchers/PendingVouchersSection";
import { ApiError } from "@/lib/api";
import { dryRunVoucher, getExchangeRate, issueVoucher, lookupTaxpayer } from "@/lib/resources";
import type { VoucherFormState } from "./use-voucher-form-state";
import { parseVoucherPayload } from "./voucher-payload";

const HTTP_SERVICE_UNAVAILABLE = 503;
const INVALID_FORM_MESSAGE = "Revisá los datos de la factura.";

export type SheetName = "tipo" | "pdv" | "moneda" | "confirm";

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const firstIssueMessage = (validationError: ZodError): string =>
  validationError.issues[0]?.message ?? INVALID_FORM_MESSAGE;

export interface VoucherEmission {
  error: string | null;
  clearError: () => void;
  queued: boolean;
  isEmitting: boolean;
  sheet: SheetName | null;
  setSheet: (sheet: SheetName | null) => void;
  emissionPlan: UseMutationResult<EmissionPlan, Error, IssueVoucher>;
  exchangeRatePending: boolean;
  padronPending: boolean;
  lookupPadron: () => void;
  chooseCurrency: (currencyId: string) => void;
  review: () => void;
  emit: () => void;
}

interface VoucherEmissionInput {
  issuerId: string;
  draft: IssueVoucher | null;
  form: VoucherFormState;
}

function useIssueMutation(
  issuerId: string,
  onFailure: (failure: Error) => void,
): UseMutationResult<IssuedVoucher, Error, IssueVoucher> {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: issueVoucher,
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["vouchers", issuerId] });
      router.replace(`/(app)/vouchers/${res.id}`);
    },
    onError: onFailure,
  });
}

export function useVoucherEmission({ issuerId, draft, form }: VoucherEmissionInput): VoucherEmission {
  const queryClient = useQueryClient();
  const { values, setters } = form;
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  const [sheet, setSheet] = useState<SheetName | null>(null);

  const mutation = useIssueMutation(issuerId, (failure) => {
    setSheet(null);
    if (failure instanceof ApiError && failure.status === HTTP_SERVICE_UNAVAILABLE) {
      void queryClient.invalidateQueries({ queryKey: pendingVouchersQueryKey(issuerId) });
      setQueued(true);
      return;
    }
    setError(errorMessage(failure, "No se pudo emitir el comprobante."));
  });

  const emissionPlan = useMutation({ mutationFn: dryRunVoucher });

  const exchangeRateLookup = useMutation({
    mutationFn: (currencyId: string) => getExchangeRate(issuerId, currencyId),
    onSuccess: (quote) => {
      setters.setExchangeRate(String(quote.rate));
    },
    onError: (failure) => {
      setError(errorMessage(failure, "No se pudo traer la cotización."));
    },
  });

  const padronLookup = useMutation({
    mutationFn: () => lookupTaxpayer(issuerId, values.docNumber.trim()),
    onSuccess: (taxpayer) => {
      setters.setLegalName(taxpayer.legalName);
      setters.setRecipientIvaConditionId(taxpayer.ivaConditionId);
      setError(null);
    },
    onError: (failure) => {
      setError(errorMessage(failure, "No se pudo consultar el padrón."));
    },
  });

  const chooseCurrency = (currencyId: string): void => {
    setters.setCurrency(currencyId);
    setSheet(null);
    if (currencyId === LOCAL_CURRENCY) {
      setters.setExchangeRate(String(LOCAL_EXCHANGE_RATE));
      return;
    }
    exchangeRateLookup.mutate(currencyId);
  };

  const review = (): void => {
    setError(null);
    const parsed = parseVoucherPayload({ issuerId, draft, values });
    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
      return;
    }
    emissionPlan.reset();
    emissionPlan.mutate(parsed.data);
    setSheet("confirm");
  };

  const emit = (): void => {
    const parsed = parseVoucherPayload({ issuerId, draft, values });
    if (!parsed.success) {
      setSheet(null);
      setError(firstIssueMessage(parsed.error));
      return;
    }
    mutation.mutate(parsed.data);
  };

  return {
    error,
    clearError: () => {
      setError(null);
    },
    queued,
    isEmitting: mutation.isPending,
    sheet,
    setSheet,
    emissionPlan,
    exchangeRatePending: exchangeRateLookup.isPending,
    padronPending: padronLookup.isPending,
    lookupPadron: () => {
      padronLookup.mutate();
    },
    chooseCurrency,
    review,
    emit,
  };
}
