import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { listIssuers, type Issuer } from '@/lib/resources';
import { getPreference, preferenceKeys, removePreference, setPreference } from '@/lib/storage';

interface ActiveIssuerState {
  issuers: Issuer[];
  activeIssuer: Issuer | null;
  activeIssuerId: string | null;
  isLoading: boolean;
  isError: boolean;
  selectIssuer: (issuerId: string) => void;
  refetch: () => void;
}

const ActiveIssuerContext = createContext<ActiveIssuerState | null>(null);

export function ActiveIssuerProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['issuers'],
    queryFn: listIssuers,
  });
  const issuers = useMemo(() => data ?? [], [data]);
  const [activeIssuerId, setActiveIssuerId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    getPreference(preferenceKeys.activeIssuerId)
      .then(setActiveIssuerId)
      .finally(() => setRestored(true));
  }, []);

  useEffect(() => {
    if (!restored || issuers.length === 0) return;
    const stillExists = activeIssuerId && issuers.some((issuer) => issuer.id === activeIssuerId);
    if (!stillExists) {
      setActiveIssuerId(issuers[0].id);
    }
  }, [restored, issuers, activeIssuerId]);

  const selectIssuer = useCallback((issuerId: string) => {
    setActiveIssuerId(issuerId);
    void setPreference(preferenceKeys.activeIssuerId, issuerId);
  }, []);

  useEffect(() => {
    if (restored && activeIssuerId === null && issuers.length === 0) {
      void removePreference(preferenceKeys.activeIssuerId);
    }
  }, [restored, activeIssuerId, issuers.length]);

  const activeIssuer = useMemo(
    () => issuers.find((issuer) => issuer.id === activeIssuerId) ?? null,
    [issuers, activeIssuerId],
  );

  const value = useMemo<ActiveIssuerState>(
    () => ({
      issuers,
      activeIssuer,
      activeIssuerId,
      isLoading: isLoading || !restored,
      isError,
      selectIssuer,
      refetch,
    }),
    [issuers, activeIssuer, activeIssuerId, isLoading, restored, isError, selectIssuer, refetch],
  );

  return <ActiveIssuerContext.Provider value={value}>{children}</ActiveIssuerContext.Provider>;
}

export function useActiveIssuer(): ActiveIssuerState {
  const ctx = useContext(ActiveIssuerContext);
  if (!ctx) throw new Error('useActiveIssuer debe usarse dentro de <ActiveIssuerProvider>.');
  return ctx;
}
