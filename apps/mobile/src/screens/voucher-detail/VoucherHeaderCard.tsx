import { Text, View } from "react-native";
import { Image } from "expo-image";
import { Amount, Card, StatusBadge } from "@/components/ds";
import { formatDate } from "@/lib/format";
import { useTheme } from "@/hooks/use-theme";
import { type StatusKey } from "@/theme/tokens";
import { hasText } from "@chirola/shared";
import type { VoucherDetail } from "@chirola/shared";
import type { ReactNode } from "react";

const CaeInfo = ({ voucher }: Readonly<{ voucher: VoucherDetail }>): ReactNode => {
  const theme = useTheme();
  return (
    <>
      <Text
        style={{
          fontFamily: theme.font.monoRegular,
          fontSize: theme.fontSize.caption,
          color: theme.colors.textSecondary,
          textAlign: "center",
        }}
      >
        CAE {voucher.cae}
        {hasText(voucher.caeExpiration) ? ` · vence ${formatDate(voucher.caeExpiration)}` : ""}
      </Text>
      <Text
        style={{
          marginTop: 2,
          fontFamily: theme.font.regular,
          fontSize: theme.fontSize.micro,
          color: theme.colors.textTertiary,
          textAlign: "center",
        }}
      >
        El CAE prueba que ARCA aprobó este comprobante.
      </Text>
    </>
  );
};

export interface VoucherHeaderCardProps {
  voucher: VoucherDetail;
  title: string;
  clientName: string;
  status: StatusKey;
  totalLabel: string;
  authorized: boolean;
  qrBase64: string | undefined;
}

export const VoucherHeaderCard = ({
  voucher,
  title,
  clientName,
  status,
  totalLabel,
  authorized,
  qrBase64,
}: Readonly<VoucherHeaderCardProps>): ReactNode => {
  const theme = useTheme();
  return (
    <Card>
      <View style={{ alignItems: "center" }}>
        <StatusBadge status={status} />
        <Text
          style={{
            marginTop: 10,
            fontFamily: theme.font.bold,
            fontSize: theme.fontSize.subhead,
            color: theme.colors.textPrimary,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: theme.font.regular,
            fontSize: theme.fontSize.caption,
            color: theme.colors.textSecondary,
          }}
        >
          {clientName} · {formatDate(voucher.voucherDate)}
        </Text>
        <View style={{ marginVertical: 10 }}>
          <Amount value={totalLabel} size="xl" />
        </View>
        {authorized && hasText(qrBase64) ? (
          <Image
            source={{ uri: `data:image/png;base64,${qrBase64}` }}
            style={{ width: 132, height: 132, marginVertical: 8 }}
            contentFit="contain"
          />
        ) : null}
        {authorized ? <CaeInfo voucher={voucher} /> : null}
      </View>
    </Card>
  );
};
