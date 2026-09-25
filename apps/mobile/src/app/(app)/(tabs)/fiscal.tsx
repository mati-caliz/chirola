import { BarChart3 } from "lucide-react-native";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Amount, Banner, Button, Card, Divider, EmptyState, StatusBadge } from "@/components/ds";
import { useActiveIssuer } from "@/lib/active-issuer";
import { getIvaPosition, getVencimientos } from "@/lib/resources";
import type { IvaPosition } from "@chirola/shared";
import { formatCurrency } from "@/lib/format";
import { useTheme } from "@/hooks/use-theme";
import { SalesBookCard } from "@/components/fiscal/SalesBookCard";
import { VencimientoList } from "@/screens/fiscal/VencimientoList";
import { hasText } from "@chirola/shared";
import type { ReactNode } from "react";

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;
const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(now);

const SectionOverline = ({ children }: Readonly<{ children: ReactNode }>): ReactNode => {
  const theme = useTheme();
  return (
    <Text
      style={{
        fontFamily: theme.font.semibold,
        fontSize: theme.fontSize.micro,
        letterSpacing: 0.66,
        textTransform: "uppercase",
        color: theme.colors.textTertiary,
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  );
};

const IvaPositionCard = ({ position }: Readonly<{ position: IvaPosition }>): ReactNode => {
  const theme = useTheme();
  const balance = position.balance;
  const payable = balance >= 0;
  return (
    <Card>
      <Text
        style={{
          fontFamily: theme.font.semibold,
          fontSize: theme.fontSize.micro,
          letterSpacing: 0.66,
          textTransform: "uppercase",
          color: theme.colors.textTertiary,
        }}
      >
        Posición de IVA · {monthLabel}
      </Text>
      <View style={{ alignItems: "center", paddingVertical: 12 }}>
        <Amount value={formatCurrency(Math.abs(balance))} size="xl" />
        <View style={{ marginTop: 6 }}>
          <StatusBadge
            status={payable ? "observado" : "aprobado"}
            label={payable ? "A pagar" : "A favor"}
            size="sm"
          />
        </View>
      </View>
      <Divider />
      <View style={{ height: 8 }} />
      <PositionRow label="IVA débito (ventas)" value={formatCurrency(position.totalDebit)} theme={theme} />
      <PositionRow label="IVA crédito (compras)" value={formatCurrency(position.totalCredit)} theme={theme} />
    </Card>
  );
};

const IvaPositionSection = ({ issuerId }: Readonly<{ issuerId: string }>): ReactNode => {
  const theme = useTheme();
  const position = useQuery({
    queryKey: ["iva-position", issuerId, currentYear, currentMonth],
    queryFn: () => getIvaPosition(issuerId, currentYear, currentMonth),
  });

  if (position.isLoading) {
    return (
      <Card>
        <ActivityIndicator color={theme.colors.actionPrimary} />
      </Card>
    );
  }
  if (position.isError) {
    return (
      <Banner
        kind="error"
        title="No pudimos calcular tu IVA"
        body="Revisá tu conexión y volvé a intentar."
        action={
          <Button
            variant="secondary"
            onPress={() => {
              void position.refetch();
            }}
          >
            Reintentar
          </Button>
        }
      />
    );
  }
  if (!position.data) return null;
  return <IvaPositionCard position={position.data} />;
};

const VencimientosContent = ({ issuerId }: Readonly<{ issuerId: string }>): ReactNode => {
  const theme = useTheme();
  const vencimientos = useQuery({
    queryKey: ["vencimientos", issuerId],
    queryFn: () => getVencimientos(issuerId),
  });

  if (vencimientos.isLoading) {
    return (
      <Card>
        <ActivityIndicator color={theme.colors.actionPrimary} />
      </Card>
    );
  }
  if (vencimientos.data && vencimientos.data.length > 0) {
    return <VencimientoList vencimientos={vencimientos.data} />;
  }
  return (
    <Card>
      <Text
        style={{
          fontFamily: theme.font.regular,
          fontSize: theme.fontSize.callout,
          color: theme.colors.textSecondary,
        }}
      >
        No hay vencimientos en los próximos 90 días.
      </Text>
    </Card>
  );
};

export default function FiscalScreen(): ReactNode {
  const theme = useTheme();
  const { activeIssuerId } = useActiveIssuer();

  if (!hasText(activeIssuerId)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={["top"]}>
        <EmptyState
          icon={(iconProps) => <BarChart3 {...iconProps} strokeWidth={1.75} />}
          title="Elegí un emisor"
          body="Agregá o seleccioná un emisor para ver su posición fiscal."
        />
      </SafeAreaView>
    );
  }

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
        <Text
          style={{
            fontFamily: theme.font.extrabold,
            fontSize: theme.fontSize.title,
            color: theme.colors.textPrimary,
          }}
        >
          Fiscal
        </Text>

        <IvaPositionSection issuerId={activeIssuerId} />

        <SalesBookCard
          issuerId={activeIssuerId}
          year={currentYear}
          month={currentMonth}
          monthLabel={monthLabel}
        />

        <View style={{ marginTop: 4 }}>
          <SectionOverline>Próximos vencimientos</SectionOverline>
          <VencimientosContent issuerId={activeIssuerId} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const PositionRow = ({
  label,
  value,
  theme,
}: Readonly<{
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
}>): ReactNode => (
  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
    <Text
      style={{
        fontFamily: theme.font.regular,
        fontSize: theme.fontSize.callout,
        color: theme.colors.textSecondary,
      }}
    >
      {label}
    </Text>
    <Text
      style={{
        fontFamily: theme.font.monoRegular,
        fontSize: theme.fontSize.callout,
        color: theme.colors.textPrimary,
      }}
    >
      {value}
    </Text>
  </View>
);
