import { Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export const Stepper = ({ steps, current = 0 }: { steps: string[]; current?: number }) => {
  const theme = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {steps.map((step, index) => (
          <View
            key={step}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: index <= current ? theme.colors.actionPrimary : theme.colors.borderDefault,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={{ fontFamily: theme.font.bold, fontSize: theme.fontSize.micro, color: theme.colors.textBrand }}>
          Paso {current + 1} de {steps.length}
        </Text>
        <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.micro, color: theme.colors.textSecondary }}>
          {steps[current]}
        </Text>
      </View>
    </View>
  );
};
