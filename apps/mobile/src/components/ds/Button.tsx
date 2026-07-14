import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme, type Theme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const sizes: Record<ButtonSize, { height: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { height: 40, paddingHorizontal: 16, fontSize: 14 },
  md: { height: 48, paddingHorizontal: 20, fontSize: 16 },
  lg: { height: 56, paddingHorizontal: 24, fontSize: 17 },
};

function variantColors(theme: Theme, variant: ButtonVariant) {
  const { colors } = theme;
  switch (variant) {
    case 'secondary':
      return { bg: colors.actionSecondary, press: colors.actionSecondaryPress, fg: colors.actionSecondaryText };
    case 'ghost':
      return { bg: 'transparent', press: colors.bgSunken, fg: colors.textBrand };
    case 'danger':
      return { bg: colors.actionDanger, press: colors.actionDangerPress, fg: colors.textInverse };
    default:
      return { bg: colors.actionPrimary, press: colors.actionPrimaryPress, fg: colors.actionPrimaryText };
  }
}

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  full = false,
  disabled = false,
  loading = false,
  icon,
  onPress,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  onPress?: () => void;
}) => {
  const theme = useTheme();
  const s = sizes[size];
  const { bg, press, fg } = variantColors(theme, variant);
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.paddingHorizontal,
          borderRadius: theme.radius.pill,
          alignSelf: full ? 'stretch' : 'flex-start',
          backgroundColor: pressed && !isDisabled ? press : bg,
          opacity: isDisabled ? 0.45 : 1,
          transform: pressed && !isDisabled ? [{ scale: 0.97 }] : [{ scale: 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <Text style={{ color: fg, fontFamily: theme.font.semibold, fontSize: s.fontSize }}>{children}</Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
