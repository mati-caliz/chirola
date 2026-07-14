import { BarChart3 } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ds';
import { useActiveIssuer } from '@/lib/active-issuer';
import { useTheme } from '@/hooks/use-theme';

export default function FiscalScreen() {
  const theme = useTheme();
  const { activeIssuer } = useActiveIssuer();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={['top']}>
      <View style={{ paddingHorizontal: theme.spacing.screenPad, paddingTop: 8 }}>
        <Text style={{ fontFamily: theme.font.extrabold, fontSize: theme.fontSize.title, color: theme.colors.textPrimary }}>
          Fiscal
        </Text>
      </View>
      <EmptyState
        icon={(p) => <BarChart3 {...p} strokeWidth={1.75} />}
        title={activeIssuer ? 'Tu posición de IVA' : 'Elegí un emisor'}
        body={
          activeIssuer
            ? 'Acá vas a ver tu IVA débito y crédito del mes, y los próximos vencimientos.'
            : 'Agregá o seleccioná un emisor para ver su posición fiscal.'
        }
      />
    </SafeAreaView>
  );
}
