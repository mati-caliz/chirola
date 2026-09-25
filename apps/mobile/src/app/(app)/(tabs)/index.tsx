import { useState, type ReactNode } from "react";
import { Bell, ChevronDown, Plus } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { skipToken, useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banner, Button, Card, EmptyState, IconButton, Loading, StatusBadge } from "@/components/ds";
import { useActiveIssuer } from "@/lib/active-issuer";
import { getFiscalAlerts } from "@/lib/resources";
import type { Issuer } from "@chirola/shared";
import { formatDate } from "@/lib/format";
import { useTheme } from "@/hooks/use-theme";
import { type StatusKey } from "@/theme/tokens";
import { IssuerPickerSheet } from "@/screens/shared/IssuerPickerSheet";
import { hasText } from "@chirola/shared";

const MILLISECONDS_PER_DAY = 86_400_000;
const CERTIFICATE_EXPIRY_WARNING_DAYS = 30;

type CertificateKind = "ok" | "missing" | "expiring";

interface CertificateStatus {
  kind: CertificateKind;
  validUntil: string | null;
}

const certificateBadge: Record<CertificateKind, { status: StatusKey; label: string }> = {
  ok: { status: "aprobado", label: "Certificado activo" },
  expiring: { status: "observado", label: "Por vencer" },
  missing: { status: "pendiente", label: "Sin certificado" },
};

function certStatus(issuer: Issuer): CertificateStatus {
  const cert = issuer.certificate;
  if (!cert) return { kind: "missing", validUntil: null };
  if (hasText(cert.validUntil)) {
    const days = (new Date(cert.validUntil).getTime() - Date.now()) / MILLISECONDS_PER_DAY;
    if (days < CERTIFICATE_EXPIRY_WARNING_DAYS) return { kind: "expiring", validUntil: cert.validUntil };
  }
  return { kind: "ok", validUntil: cert.validUntil };
}

const Wordmark = (): ReactNode => {
  const theme = useTheme();
  return (
    <Text
      style={{
        fontFamily: theme.font.extrabold,
        fontSize: theme.fontSize.heading,
        color: theme.colors.textBrand,
      }}
    >
      Chirola
    </Text>
  );
};

const NoIssuerState = (): ReactNode => {
  const theme = useTheme();
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={["top"]}>
      <View style={{ padding: theme.spacing.screenPad }}>
        <Wordmark />
      </View>
      <EmptyState
        icon={(item) => <Plus {...item} strokeWidth={1.75} />}
        title="Agregá tu primer emisor"
        body="Un emisor es el CUIT en cuyo nombre vas a facturar. Podés administrar varios."
        action={
          <Button
            variant="primary"
            onPress={() => {
              router.push("/(app)/issuers/new");
            }}
          >
            Agregar emisor
          </Button>
        }
      />
    </SafeAreaView>
  );
};

const useHasFiscalAlerts = (issuerId: string | null): boolean => {
  const { data: alerts } = useQuery({
    queryKey: ["fiscal-alerts", issuerId],
    queryFn: hasText(issuerId) ? () => getFiscalAlerts(issuerId) : skipToken,
  });
  return alerts !== undefined && (alerts.certificate !== null || alerts.vencimientos.length > 0);
};

const AlertsButton = ({ hasAlerts }: Readonly<{ hasAlerts: boolean }>): ReactNode => {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View>
      <IconButton
        label="Novedades"
        icon={(item) => <Bell {...item} strokeWidth={2} />}
        onPress={() => {
          router.push("/(app)/notifications");
        }}
      />
      {hasAlerts ? (
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: theme.colors.actionDanger,
            borderWidth: 1.5,
            borderColor: theme.colors.bgApp,
          }}
        />
      ) : null}
    </View>
  );
};

interface DashboardHeaderProps {
  issuer: Issuer;
  hasAlerts: boolean;
  onOpenPicker: () => void;
}

const DashboardHeader = ({ issuer, hasAlerts, onOpenPicker }: Readonly<DashboardHeaderProps>): ReactNode => {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Wordmark />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <AlertsButton hasAlerts={hasAlerts} />
        <Pressable
          onPress={onOpenPicker}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 12,
            height: 36,
            borderRadius: theme.radius.pill,
            backgroundColor: pressed ? theme.colors.bgSunken : theme.colors.surfaceCard,
            borderWidth: 1,
            borderColor: theme.colors.borderSubtle,
          })}
        >
          <Text
            numberOfLines={1}
            style={{
              maxWidth: 140,
              fontFamily: theme.font.semibold,
              fontSize: theme.fontSize.caption,
              color: theme.colors.textPrimary,
            }}
          >
            {issuer.legalName}
          </Text>
          <ChevronDown size={16} color={theme.colors.textSecondary} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
};

const CertificateBanner = ({
  issuerId,
  certificate,
}: Readonly<{ issuerId: string; certificate: CertificateStatus }>): ReactNode => {
  const router = useRouter();
  if (certificate.kind === "missing") {
    return (
      <Banner
        kind="warning"
        title="Configurá tu certificado"
        body="Necesitás el certificado de ARCA para poder emitir. Se hace una sola vez."
        action={
          <Button
            variant="secondary"
            onPress={() => {
              router.push(`/(app)/issuers/${issuerId}/certificate`);
            }}
          >
            Configurar ahora
          </Button>
        }
      />
    );
  }
  if (certificate.kind === "expiring") {
    return (
      <Banner
        kind="warning"
        title="Tu certificado está por vencer"
        body={
          hasText(certificate.validUntil)
            ? `Vence el ${formatDate(certificate.validUntil)}. Renovalo para seguir emitiendo.`
            : "Renovalo para seguir emitiendo."
        }
      />
    );
  }
  return null;
};

const IssuerSummaryCard = ({
  issuer,
  certificate,
}: Readonly<{ issuer: Issuer; certificate: CertificateStatus }>): ReactNode => {
  const theme = useTheme();
  const badge = certificateBadge[certificate.kind];
  return (
    <Card>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontFamily: theme.font.semibold,
            fontSize: theme.fontSize.body,
            color: theme.colors.textPrimary,
          }}
        >
          {issuer.legalName}
        </Text>
        <StatusBadge status={badge.status} label={badge.label} size="sm" />
      </View>
      <Text
        style={{
          fontFamily: theme.font.monoRegular,
          fontSize: theme.fontSize.callout,
          color: theme.colors.textSecondary,
        }}
      >
        CUIT {issuer.cuit}
      </Text>
    </Card>
  );
};

export default function DashboardScreen(): ReactNode {
  const theme = useTheme();
  const router = useRouter();
  const { activeIssuer, activeIssuerId, isLoading } = useActiveIssuer();
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasAlerts = useHasFiscalAlerts(activeIssuerId);

  if (isLoading) return <Loading />;
  if (!activeIssuer) return <NoIssuerState />;

  const cert = certStatus(activeIssuer);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.screenPad,
          gap: theme.spacing.stackGap,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <DashboardHeader
          issuer={activeIssuer}
          hasAlerts={hasAlerts}
          onOpenPicker={() => {
            setPickerOpen(true);
          }}
        />
        <CertificateBanner issuerId={activeIssuer.id} certificate={cert} />
        <IssuerSummaryCard issuer={activeIssuer} certificate={cert} />

        <Button
          variant="primary"
          full
          disabled={cert.kind === "missing"}
          onPress={() => {
            router.push(`/(app)/issuers/${activeIssuer.id}/vouchers/new`);
          }}
        >
          Emitir comprobante
        </Button>
        <Button
          variant="secondary"
          full
          onPress={() => {
            router.push(`/(app)/issuers/${activeIssuer.id}/clients`);
          }}
        >
          Clientes
        </Button>
      </ScrollView>

      <IssuerPickerSheet
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}
