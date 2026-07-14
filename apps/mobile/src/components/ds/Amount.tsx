import { Text, type TextStyle } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export type AmountSize = 'sm' | 'md' | 'xl';

const fontSizes: Record<AmountSize, number> = { sm: 16, md: 24, xl: 40 };

export const Amount = ({
  value,
  size = 'md',
  currency,
  muted = false,
  style,
}: {
  value: string;
  size?: AmountSize;
  currency?: string;
  muted?: boolean;
  style?: TextStyle;
}) => {
  const theme = useTheme();
  const fs = fontSizes[size];
  return (
    <Text
      style={[
        {
          fontFamily: theme.font.monoSemibold,
          fontVariant: ['tabular-nums'],
          fontSize: fs,
          letterSpacing: -0.3,
          color: muted ? theme.colors.textSecondary : theme.colors.textPrimary,
        },
        style,
      ]}
    >
      {value}
      {currency ? (
        <Text
          style={{
            fontFamily: theme.font.monoMedium,
            fontSize: Math.round(fs * 0.55),
            color: theme.colors.textTertiary,
          }}
        >
          {`  ${currency}`}
        </Text>
      ) : null}
    </Text>
  );
};
