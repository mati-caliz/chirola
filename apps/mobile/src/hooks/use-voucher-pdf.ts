import { useState } from "react";
import { File, Paths } from "expo-file-system";
import { apiFetchBase64 } from "@/lib/api";

type PdfAction = (fileUri: string) => Promise<void>;

export interface VoucherPdfState {
  loading: boolean;
  error: string | null;
  withPdf: (action: PdfAction) => Promise<void>;
}

export function useVoucherPdf(voucherId: string): VoucherPdfState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withPdf = async (action: PdfAction): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      const base64 = await apiFetchBase64(`/vouchers/${voucherId}/pdf`);
      const file = new File(Paths.cache, `comprobante-${voucherId}.pdf`);
      if (file.exists) {
        file.delete();
      }
      file.write(base64, { encoding: "base64" });
      await action(file.uri);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo generar el PDF.");
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, withPdf };
}
