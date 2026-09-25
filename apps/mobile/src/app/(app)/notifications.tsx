import { BellOff, ShieldAlert } from "lucide-react-native";
import { ActivityIndicator, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { skipToken, useQuery } from "@tanstack/react-query";
import { Banner, Card, EmptyState, Screen } from "@/components/ds";
import { useActiveIssuer } from "@/lib/active-issuer";
import { getFiscalAlerts } from "@/lib/resources";
import type { FiscalAlerts } from "@chirola/shared";
import { formatDate } from "@/lib/format";
import { useTheme } from "@/hooks/use-theme";
import { VencimientoList } from "@/screens/fiscal/VencimientoList";
import { hasText } from "@chirola/shared";
import type { ReactNode } from "react";

type CertificateAlert = NonNullable<FiscalAlerts["certificate"]>;

const CertificateExpiryBanner = ({ certificate }: Readonly<{ certificate: CertificateAlert }>): ReactNode => {
  const expired = certificate.daysToExpiry <= 0;
  return (
    <Banner
      kind={expired ? "error" : "warning"}
      title={expired ? "Tu certificado venció" : `Tu certificado vence en ${certificate.daysToExpiry} días`}
      body={`Vence el ${formatDate(certificate.validUntil)}. Renovalo para seguir emitiendo.`}
    />
  );
};

const RenewCertificateCard = ({ issuerId }: Readonly<{ issuerId: string }>): ReactNode => {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Card
      onPress={() => {
        router.push(`/(app)/issuers/${issuerId}/certificate`);
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <ShieldAlert size={20} color={theme.colors.textBrand} strokeWidth={2} />
        <Text
          style={{
            fontFamily: theme.font.semibold,
            fontSize: theme.fontSize.callout,
            color: theme.colors.textBrand,
          }}
        >
          Renovar certificado
        </Text>
      </View>
    </Card>
  );
};

const AlertsList = ({ alerts }: Readonly<{ alerts: FiscalAlerts }>): ReactNode => {
  const { activeIssuer } = useActiveIssuer();
  const certificateAlert = activeIssuer ? alerts.certificate : null;
  return (
    <>
      {certificateAlert ? <CertificateExpiryBanner certificate={certificateAlert} /> : null}
      {alerts.vencimientos.length > 0 ? <VencimientoList vencimientos={alerts.vencimientos} /> : null}
      {certificateAlert && activeIssuer ? <RenewCertificateCard issuerId={activeIssuer.id} /> : null}
    </>
  );
};

const hasAnyAlert = (alerts: FiscalAlerts | undefined): alerts is FiscalAlerts =>
  alerts !== undefined && (alerts.certificate !== null || alerts.vencimientos.length > 0);

const NotificationsContent = (): ReactNode => {
  const theme = useTheme();
  const { activeIssuerId } = useActiveIssuer();
  const { data, isLoading } = useQuery({
    queryKey: ["fiscal-alerts", activeIssuerId],
    queryFn: hasText(activeIssuerId) ? () => getFiscalAlerts(activeIssuerId) : skipToken,
  });

  if (isLoading) {
    return (
      <View style={{ paddingVertical: 40, alignItems: "center" }}>
        <ActivityIndicator color={theme.colors.actionPrimary} size="large" />
      </View>
    );
  }
  if (!hasAnyAlert(data)) {
    return (
      <EmptyState
        icon={(iconProps) => <BellOff {...iconProps} strokeWidth={1.75} />}
        title="Estás al día"
        body="No hay vencimientos próximos ni avisos de tu certificado."
      />
    );
  }
  return <AlertsList alerts={data} />;
};

export default function NotificationsScreen(): ReactNode {
  return (
    <>
      <Stack.Screen options={{ title: "Novedades" }} />
      <Screen>
        <NotificationsContent />
      </Screen>
    </>
  );
}
