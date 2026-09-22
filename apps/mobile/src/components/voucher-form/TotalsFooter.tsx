import { ActivityIndicator, Text, View } from 'react-native';
import type { DraftAmountsInput } from '@chirola/shared';
import { Amount, Button } from '@/components/ds';
import { formatCurrency } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';
import { useDraftAmounts } from './use-draft-amounts';

interface TotalsFooterProps {
  amountsInput: DraftAmountsInput | null;
  currency: string;
  onReview: () => void;
}

export const TotalsFooter = ({ amountsInput, currency, onReview }: TotalsFooterProps) => {
  const theme = useTheme();
  const amounts = useDraftAmounts(amountsInput);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle, backgroundColor: theme.colors.surfaceCard, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6, gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary }}>
          Total con IVA
        </Text>
        {amounts.data ? (
          <Amount value={formatCurrency(amounts.data.totalAmount, currency)} />
        ) : amounts.isFetching ? (
          <ActivityIndicator color={theme.colors.actionPrimary} />
        ) : (
          <Text style={{ fontFamily: theme.font.monoRegular, fontSize: theme.fontSize.callout, color: theme.colors.textTertiary }}>—</Text>
        )}
      </View>
      <Button variant="primary" full onPress={onReview}>
        Revisar y emitir
      </Button>
    </View>
  );
};
