import { useState } from 'react';
import { File, Paths } from 'expo-file-system';
import { apiFetchBase64 } from '@/lib/api';

export function useVoucherPdf(voucherId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withPdf = async (action: (fileUri: string) => Promise<void>) => {
    setError(null);
    setLoading(true);
    try {
      const base64 = await apiFetchBase64(`/vouchers/${voucherId}/pdf`);
      const file = new File(Paths.cache, `comprobante-${voucherId}.pdf`);
      if (file.exists) {
        file.delete();
      }
      file.write(base64, { encoding: 'base64' });
      await action(file.uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el PDF.');
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, withPdf };
}
