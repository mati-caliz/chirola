import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export const Card = ({
  children,
  onPress,
  pad = 16,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  pad?: number;
  style?: ViewStyle;
}) => {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.radius.lg,
    padding: pad,
    borderWidth: theme.scheme === 'dark' ? StyleSheet.hairlineWidth : 0,
    borderColor: theme.colors.borderSubtle,
    ...theme.shadow.card,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          base,
          pressed ? { backgroundColor: theme.colors.bgSunken } : null,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
};
