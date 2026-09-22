import { Clock } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ds';
import { useTheme } from '@/hooks/use-theme';

interface QueuedEmissionScreenProps {
  onSeeVouchers: () => void;
  onExit: () => void;
}

export const QueuedEmissionScreen = ({ onSeeVouchers, onExit }: QueuedEmissionScreenProps) => {
  const theme = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.statusPendienteBg, alignItems: 'center', justifyContent: 'center' }}>
          <Clock size={44} color={theme.colors.statusPendienteFg} strokeWidth={2.25} />
        </View>
        <Text style={{ fontFamily: theme.font.extrabold, fontSize: theme.fontSize.heading, color: theme.colors.textPrimary, textAlign: 'center' }}>
          Quedó en cola
        </Text>
        <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 300 }}>
          ARCA no respondió a tiempo. No hace falta que lo vuelvas a emitir: lo reintentamos solos y te avisamos cuando tenga CAE.
        </Text>
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 8 }}>
          <Button variant="primary" full onPress={onSeeVouchers}>
            Ver comprobantes
          </Button>
          <Button variant="ghost" full onPress={onExit}>
            Salir
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};
