import { ActivityIndicator, Text, View } from 'react-native';
import type { EmissionPlan } from '@chirola/shared';
import { Amount, Banner, BottomSheet, Button } from '@/components/ds';
import { formatCurrency, formatVoucherNumber } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

interface ConfirmEmissionSheetProps {
  open: boolean;
  typeLabel: string | undefined;
  clientLabel: string;
  currency: string;
  plan: EmissionPlan | undefined;
  planLoading: boolean;
  planError: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmEmissionSheet = ({
  open,
  typeLabel,
  clientLabel,
  currency,
  plan,
  planLoading,
  planError,
  onClose,
  onConfirm,
}: ConfirmEmissionSheetProps) => {
  const theme = useTheme();
  return (
    <BottomSheet open={open} title="Revisá antes de emitir" onClose={onClose}>
      <View style={{ backgroundColor: theme.colors.surfaceBrandSubtle, borderRadius: theme.radius.md, padding: 16, alignItems: 'center', marginBottom: 14 }}>
        <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary }}>
          Vas a emitir
        </Text>
        <Text style={{ fontFamily: theme.font.bold, fontSize: theme.fontSize.subhead, color: theme.colors.textPrimary, marginTop: 2, textAlign: 'center' }}>
          {typeLabel}
          {plan ? ` ${formatVoucherNumber(plan.salesPoint, plan.number)}` : ''}
        </Text>
        {planLoading ? (
          <ActivityIndicator style={{ marginTop: 12 }} color={theme.colors.actionPrimary} />
        ) : plan ? (
          <View style={{ marginTop: 8 }}>
            <Amount value={formatCurrency(plan.totalAmount, currency)} size="xl" />
          </View>
        ) : null}
        <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary, marginTop: 6 }}>
          a {clientLabel} · IVA incluido
        </Text>
      </View>
      {planError ? (
        <View style={{ marginBottom: 12 }}>
          <Banner
            kind="warning"
            title="No pudimos confirmar la numeración con ARCA"
            body={`${planError} Podés emitir igual: el número lo asigna ARCA al autorizar.`}
          />
        </View>
      ) : null}
      <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary, marginBottom: 12 }}>
        Una vez emitida es un documento legal: si hay un error, después se corrige con una Nota de Crédito.
      </Text>
      <Button variant="primary" full disabled={planLoading} onPress={onConfirm}>
        Confirmar y emitir
      </Button>
    </BottomSheet>
  );
};
