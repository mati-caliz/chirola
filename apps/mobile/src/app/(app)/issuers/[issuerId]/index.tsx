import { FileText, ShieldCheck, Store, Users } from "lucide-react-native";
import { Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Banner, Button, Card, Divider, ListItem, Loading, Screen, StatusBadge } from "@/components/ds";
import { listIssuers } from "@/lib/resources";
import type { Issuer } from "@chirola/shared";
import { formatDate } from "@/lib/format";
import { useTheme } from "@/hooks/use-theme";
import { hasText } from "@chirola/shared";
import type { ReactNode } from "react";

const ivaConditionLabel: Record<string, string> = {
  RESPONSABLE_INSCRIPTO: "Responsable Inscripto",
  MONOTRIBUTO: "Monotributo",
  EXENTO: "Exento",
};

const certificateLabel = (certificate: Issuer["certificate"]): string => {
  if (certificate === null) return "Sin certificado";
  return hasText(certificate.validUntil) ? `Vence ${formatDate(certificate.validUntil)}` : "Cargado";
};

const IssuerInfoCard = ({ issuer }: Readonly<{ issuer: Issuer }>): ReactNode => {
  const theme = useTheme();
  return (
    <Card>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: theme.font.bold,
              fontSize: theme.fontSize.subhead,
              color: theme.colors.textPrimary,
            }}
          >
            {issuer.legalName}
          </Text>
          <Text
            style={{
              marginTop: 2,
              fontFamily: theme.font.monoRegular,
              fontSize: theme.fontSize.callout,
              color: theme.colors.textSecondary,
            }}
          >
            CUIT {issuer.cuit}
          </Text>
        </View>
        <StatusBadge status="pendiente" label={issuer.environment} size="sm" />
      </View>
      <View style={{ height: 10 }} />
      <Divider />
      <View style={{ height: 10 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text
          style={{
            fontFamily: theme.font.regular,
            fontSize: theme.fontSize.callout,
            color: theme.colors.textSecondary,
          }}
        >
          Condición frente al IVA
        </Text>
        <Text
          style={{
            fontFamily: theme.font.medium,
            fontSize: theme.fontSize.callout,
            color: theme.colors.textPrimary,
          }}
        >
          {ivaConditionLabel[issuer.ivaCondition] ?? issuer.ivaCondition}
        </Text>
      </View>
    </Card>
  );
};

const CertificateCard = ({ issuer }: Readonly<{ issuer: Issuer }>): ReactNode => {
  const theme = useTheme();
  const router = useRouter();
  const hasCertificate = issuer.certificate !== null;
  return (
    <Card>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <Text
          style={{
            fontFamily: theme.font.semibold,
            fontSize: theme.fontSize.callout,
            color: theme.colors.textPrimary,
          }}
        >
          Certificado ARCA
        </Text>
        <StatusBadge
          status={hasCertificate ? "aprobado" : "pendiente"}
          label={certificateLabel(issuer.certificate)}
          size="sm"
        />
      </View>
      <Button
        variant="secondary"
        full
        onPress={() => {
          router.push(`/(app)/issuers/${issuer.id}/certificate`);
        }}
      >
        {hasCertificate ? "Ver / renovar certificado" : "Configurar certificado"}
      </Button>
    </Card>
  );
};

const IssuerLinks = ({ issuerId }: Readonly<{ issuerId: string }>): ReactNode => {
  const theme = useTheme();
  const router = useRouter();
  const rowIcon = (Icon: typeof Users): ReactNode => (
    <Icon size={20} color={theme.colors.textSecondary} strokeWidth={2} />
  );
  return (
    <Card pad={4}>
      <ListItem
        title="Clientes"
        leading={rowIcon(Users)}
        chevron
        onPress={() => {
          router.push(`/(app)/issuers/${issuerId}/clients`);
        }}
      />
      <Divider inset={16} />
      <ListItem
        title="Puntos de venta"
        leading={rowIcon(Store)}
        chevron
        onPress={() => {
          router.push(`/(app)/issuers/${issuerId}/sales-points`);
        }}
      />
      <Divider inset={16} />
      <ListItem
        title="Certificado ARCA"
        leading={rowIcon(ShieldCheck)}
        chevron
        onPress={() => {
          router.push(`/(app)/issuers/${issuerId}/certificate`);
        }}
      />
    </Card>
  );
};

export default function IssuerDetailScreen(): ReactNode {
  const theme = useTheme();
  const { issuerId } = useLocalSearchParams<{ issuerId: string }>();
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ["issuers"], queryFn: listIssuers });

  const issuer = data?.find((candidate: Issuer) => candidate.id === issuerId);

  if (isLoading) return <Loading />;
  if (!issuer) {
    return (
      <>
        <Stack.Screen options={{ title: "Emisor" }} />
        <Screen>
          <Banner kind="error" title="No se encontró el emisor" />
        </Screen>
      </>
    );
  }

  const hasCertificate = issuer.certificate !== null;

  return (
    <>
      <Stack.Screen options={{ title: issuer.legalName }} />
      <Screen>
        <IssuerInfoCard issuer={issuer} />
        <CertificateCard issuer={issuer} />
        <IssuerLinks issuerId={issuer.id} />

        <Button
          variant="primary"
          full
          disabled={!hasCertificate}
          icon={<FileText size={18} color={theme.colors.actionPrimaryText} strokeWidth={2} />}
          onPress={() => {
            router.push(`/(app)/issuers/${issuer.id}/vouchers/new`);
          }}
        >
          Emitir comprobante
        </Button>
        {!hasCertificate ? (
          <Banner kind="warning" title="Configurá el certificado para poder emitir" />
        ) : null}
      </Screen>
    </>
  );
}
