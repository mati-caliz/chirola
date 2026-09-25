import { useState } from "react";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateCsr, matchCertificate } from "@/lib/resources";
import { hasText } from "@chirola/shared";

export const WizardStep = {
  intro: 0,
  upload: 1,
  paste: 2,
  done: 3,
} as const;

const COPIED_FEEDBACK_MS = 2000;

export interface CertificateWizard {
  step: number;
  csrPem: string | null;
  certPem: string;
  copied: boolean;
  error: string | null;
  primaryLoading: boolean;
  setCertPem: (value: string) => void;
  goBack: () => void;
  copyCsr: () => Promise<void>;
  advance: () => void;
}

export const useCertificateWizard = (issuerId: string): CertificateWizard => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<number>(WizardStep.intro);
  const [csrPem, setCsrPem] = useState<string | null>(null);
  const [certPem, setCertPem] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const csrMutation = useMutation({
    mutationFn: () => generateCsr(issuerId),
    onSuccess: (response) => {
      setError(null);
      setCsrPem(response.csrPem);
      setStep(WizardStep.upload);
    },
    onError: (entry) => {
      setError(entry instanceof Error ? entry.message : "No se pudo generar el pedido.");
    },
  });

  const certMutation = useMutation({
    mutationFn: () => matchCertificate(issuerId, certPem.trim()),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["issuers"] });
      setStep(WizardStep.done);
    },
    onError: (entry) => {
      setError(entry instanceof Error ? entry.message : "No se pudo emparejar el certificado.");
    },
  });

  const copyCsr = async (): Promise<void> => {
    if (!hasText(csrPem)) return;
    await Clipboard.setStringAsync(csrPem);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, COPIED_FEEDBACK_MS);
  };

  const submitCertificate = (): void => {
    if (certPem.trim().length === 0) {
      setError("Pegá el certificado que descargaste de ARCA.");
      return;
    }
    certMutation.mutate();
  };

  const advance = (): void => {
    setError(null);
    if (step === WizardStep.intro) {
      if (hasText(csrPem)) setStep(WizardStep.upload);
      else csrMutation.mutate();
      return;
    }
    if (step === WizardStep.upload) {
      setStep(WizardStep.paste);
      return;
    }
    if (step === WizardStep.paste) {
      submitCertificate();
      return;
    }
    router.replace(`/(app)/issuers/${issuerId}/vouchers/new`);
  };

  const primaryLoading =
    (step === WizardStep.intro && csrMutation.isPending) ||
    (step === WizardStep.paste && certMutation.isPending);

  return {
    step,
    csrPem,
    certPem,
    copied,
    error,
    primaryLoading,
    setCertPem,
    goBack: () => {
      setStep(step - 1);
    },
    copyCsr,
    advance,
  };
};
