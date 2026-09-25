import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { listIssuers } from "@/lib/resources";
import type { Issuer } from "@chirola/shared";
import { hasText } from "@chirola/shared";
import { getPreference, preferenceKeys, removePreference, setPreference } from "@/lib/storage";

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

export function ActiveIssuerProvider({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["issuers"],
    queryFn: listIssuers,
  });
  const issuers = useMemo(() => data ?? [], [data]);
  const [activeIssuerId, setActiveIssuerId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    void getPreference(preferenceKeys.activeIssuerId)
      .then(setActiveIssuerId)
      .finally(() => {
        setRestored(true);
      });
  }, []);

  useEffect(() => {
    if (!restored || issuers.length === 0) return;
    const stillExists = hasText(activeIssuerId) && issuers.some((issuer) => issuer.id === activeIssuerId);
    const firstIssuer = issuers[0];
    if (!stillExists && firstIssuer !== undefined) {
      setActiveIssuerId(firstIssuer.id);
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

  const refetchIssuers = useCallback(() => {
    void refetch();
  }, [refetch]);

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
      refetch: refetchIssuers,
    }),
    [issuers, activeIssuer, activeIssuerId, isLoading, restored, isError, selectIssuer, refetchIssuers],
  );

  return <ActiveIssuerContext.Provider value={value}>{children}</ActiveIssuerContext.Provider>;
}

export function useActiveIssuer(): ActiveIssuerState {
  const ctx = useContext(ActiveIssuerContext);
  if (ctx === null) throw new Error("useActiveIssuer debe usarse dentro de <ActiveIssuerProvider>.");
  return ctx;
}
