import { Text, View } from "react-native";
import { documentTypeName, LOCAL_CURRENCY, hasText } from "@chirola/shared";
import { Banner, Card, Divider } from "@/components/ds";
import { useTheme } from "@/hooks/use-theme";
import { type StatusKey } from "@/theme/tokens";
import type { VoucherDetail } from "@chirola/shared";
import type { ReactNode } from "react";

function observationsText(voucher: VoucherDetail): string {
  const observations = voucher.arcaObservations ?? [];
  if (observations.length === 0) {
    return "ARCA la aprobó igual, pero conviene revisar el aviso.";
  }
  return observations.map(({ code, message }) => (code ? `(${code}) ${message}` : message)).join("\n");
}

const SectionOverline = ({ children }: Readonly<{ children: string }>): ReactNode => {
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

export const VoucherStatusBanner = ({
  voucher,
  status,
}: Readonly<{ voucher: VoucherDetail; status: StatusKey }>): ReactNode => {
  if (status === "observado") {
    return <Banner kind="warning" title="Aprobada con observaciones" body={observationsText(voucher)} />;
  }
  if (status === "rechazado") {
    return (
      <Banner
        kind="error"
        title="ARCA rechazó este comprobante"
        body="No tiene validez fiscal. Corregí el dato observado y volvé a emitir."
      />
    );
  }
  return null;
};

const TotalRow = ({
  label,
  value,
  bold,
}: Readonly<{ label: string; value: string; bold?: boolean }>): ReactNode => {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
      <Text
        style={{
          fontFamily: theme.font.regular,
          fontSize: bold ? theme.fontSize.body : theme.fontSize.callout,
          color: theme.colors.textSecondary,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: bold ? theme.font.monoSemibold : theme.font.monoRegular,
          fontSize: bold ? theme.fontSize.subhead : theme.fontSize.callout,
          color: theme.colors.textPrimary,
        }}
      >
        {value}
      </Text>
    </View>
  );
};

export const VoucherItemsCard = ({
  voucher,
  money,
}: Readonly<{ voucher: VoucherDetail; money: (value: string) => string }>): ReactNode => {
  const theme = useTheme();
  return (
    <Card>
      <SectionOverline>Detalle</SectionOverline>
      {voucher.items.map((item) => (
        <View
          key={item.id}
          style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 6 }}
        >
          <Text
            style={{
              flex: 1,
              fontFamily: theme.font.regular,
              fontSize: theme.fontSize.callout,
              color: theme.colors.textPrimary,
            }}
          >
            {Number(item.quantity)} × {item.description}
          </Text>
          <Text
            style={{
              fontFamily: theme.font.monoRegular,
              fontSize: theme.fontSize.callout,
              color: theme.colors.textPrimary,
            }}
          >
            {money(item.subtotal)}
          </Text>
        </View>
      ))}
      <Divider />
      <View style={{ height: 8 }} />
      <TotalRow label="Neto" value={money(voucher.netAmount)} />
      <TotalRow label="IVA" value={money(voucher.ivaAmount)} />
      <TotalRow label="Total" value={money(voucher.totalAmount)} bold />
      {voucher.currency !== LOCAL_CURRENCY ? (
        <TotalRow label="Cotización" value={Number(voucher.exchangeRate).toLocaleString("es-AR")} />
      ) : null}
    </Card>
  );
};

export interface RecipientCardProps {
  clientName: string;
  docType: number | null;
  docNumber: string;
  email: string | null | undefined;
}

export const RecipientCard = ({
  clientName,
  docType,
  docNumber,
  email,
}: Readonly<RecipientCardProps>): ReactNode => {
  const theme = useTheme();
  return (
    <Card>
      <SectionOverline>Receptor</SectionOverline>
      <Text
        style={{
          fontFamily: theme.font.regular,
          fontSize: theme.fontSize.body,
          color: theme.colors.textPrimary,
        }}
      >
        {clientName}
      </Text>
      <Text
        style={{
          fontFamily: theme.font.monoRegular,
          fontSize: theme.fontSize.caption,
          color: theme.colors.textSecondary,
        }}
      >
        {docType === null ? "" : (documentTypeName[docType] ?? docType)} {docNumber}
      </Text>
      {hasText(email) ? (
        <Text
          style={{
            fontFamily: theme.font.regular,
            fontSize: theme.fontSize.caption,
            color: theme.colors.textSecondary,
          }}
        >
          {email}
        </Text>
      ) : null}
    </Card>
  );
};
