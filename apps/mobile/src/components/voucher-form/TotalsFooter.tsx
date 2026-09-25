import { ActivityIndicator, Text, View } from "react-native";
import type { DraftAmounts, DraftAmountsInput } from "@chirola/shared";
import { Amount, Button } from "@/components/ds";
import { formatCurrency } from "@/lib/format";
import { useTheme } from "@/hooks/use-theme";
import { useDraftAmounts } from "./use-draft-amounts";
import type { ReactNode } from "react";

interface TotalsFooterProps {
  amountsInput: DraftAmountsInput | null;
  currency: string;
  onReview: () => void;
}

const TotalAmountValue = ({
  amounts,
  isFetching,
  currency,
}: Readonly<{ amounts: DraftAmounts | undefined; isFetching: boolean; currency: string }>): ReactNode => {
  const theme = useTheme();
  if (amounts !== undefined) {
    return <Amount value={formatCurrency(amounts.totalAmount, currency)} />;
  }
  if (isFetching) {
    return <ActivityIndicator color={theme.colors.actionPrimary} />;
  }
  return (
    <Text
      style={{
        fontFamily: theme.font.monoRegular,
        fontSize: theme.fontSize.callout,
        color: theme.colors.textTertiary,
      }}
    >
      —
    </Text>
  );
};

export const TotalsFooter = ({ amountsInput, currency, onReview }: TotalsFooterProps): ReactNode => {
  const theme = useTheme();
  const amounts = useDraftAmounts(amountsInput);
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: theme.colors.borderSubtle,
        backgroundColor: theme.colors.surfaceCard,
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 6,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text
          style={{
            fontFamily: theme.font.regular,
            fontSize: theme.fontSize.callout,
            color: theme.colors.textSecondary,
          }}
        >
          Total con IVA
        </Text>
        <TotalAmountValue amounts={amounts.data} isFetching={amounts.isFetching} currency={currency} />
      </View>
      <Button variant="primary" full onPress={onReview}>
        Revisar y emitir
      </Button>
    </View>
  );
};
