import { type ReactNode } from 'react';
import { Pressable } from 'react-native';
import { useTheme, type Theme } from '@/hooks/use-theme';

export type IconButtonVariant = 'plain' | 'tonal' | 'filled';

export type IconRender = (props: { color: string; size: number }) => ReactNode;

function variantColors(theme: Theme, variant: IconButtonVariant) {
  const { colors } = theme;
  switch (variant) {
    case 'tonal':
      return { bg: colors.actionSecondary, fg: colors.actionSecondaryText };
    case 'filled':
      return { bg: colors.actionPrimary, fg: colors.actionPrimaryText };
    default:
      return { bg: 'transparent', fg: colors.textSecondary };
  }
}

export const IconButton = ({
  icon,
  label,
  size = 44,
  iconSize = 22,
  variant = 'plain',
  onPress,
}: {
  icon: IconRender;
  label: string;
  size?: number;
  iconSize?: number;
  variant?: IconButtonVariant;
  onPress?: () => void;
}) => {
  const theme = useTheme();
  const { bg, fg } = variantColors(theme, variant);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: theme.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? theme.colors.bgSunken : bg,
        transform: pressed ? [{ scale: 0.94 }] : [{ scale: 1 }],
      })}
    >
      {icon({ color: fg, size: iconSize })}
    </Pressable>
  );
};
