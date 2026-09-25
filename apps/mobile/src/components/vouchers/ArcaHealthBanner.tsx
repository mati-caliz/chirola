import { useQuery } from "@tanstack/react-query";
import { Banner } from "@/components/ds";
import { getArcaHealth } from "@/lib/resources";

const HEALTH_REFRESH_MS = 60_000;

export const ArcaHealthBanner = ({ issuerId }: { issuerId: string }) => {
  const { data } = useQuery({
    queryKey: ["arca-health", issuerId],
    queryFn: () => getArcaHealth(issuerId),
    refetchInterval: HEALTH_REFRESH_MS,
  });

  if (!data || data.available) {
    return null;
  }

  const down = [
    data.authServer ? null : "autenticación",
    data.appServer ? null : "aplicación",
    data.dbServer ? null : "base de datos",
  ].filter((part): part is string => part !== null);

  return (
    <Banner
      kind="warning"
      title="ARCA está con problemas"
      body={`Hoy no responden sus servidores de ${down.join(", ")}. Si emitís igual, el comprobante puede quedar en cola hasta que ARCA vuelva.`}
    />
  );
};
