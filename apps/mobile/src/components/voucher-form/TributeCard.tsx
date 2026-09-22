import { Text, View } from 'react-native';
import { tributeTypeName } from '@chirola/shared';
import { Button, Card, Input } from '@/components/ds';
import { useTheme } from '@/hooks/use-theme';
import type { TributeForm } from './form-model';

interface TributeCardProps {
  tribute: TributeForm;
  onChange: (patch: Partial<TributeForm>) => void;
  onRemove: () => void;
}

export const TributeCard = ({ tribute, onChange, onRemove }: TributeCardProps) => {
  const theme = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.micro, letterSpacing: 0.66, textTransform: 'uppercase', color: theme.colors.textTertiary }}>
          {tributeTypeName[tribute.id] ?? 'Tributo'}
        </Text>
        <Button variant="ghost" size="sm" onPress={onRemove}>
          Quitar
        </Button>
      </View>
      <Input label="Descripción" value={tribute.description} onChangeText={(description) => onChange({ description })} />
      <View style={{ height: 10 }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input
            label="Base imponible"
            value={tribute.taxableBase}
            onChangeText={(taxableBase) => onChange({ taxableBase })}
            keyboardType="decimal-pad"
            mono
            prefix="$"
          />
        </View>
        <View style={{ width: 96 }}>
          <Input label="Alícuota" value={tribute.rate} onChangeText={(rate) => onChange({ rate })} keyboardType="decimal-pad" mono />
        </View>
      </View>
    </Card>
  );
};
