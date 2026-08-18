import { ChevronDown } from 'lucide-react-native';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export const Select = ({
  label,
  value,
  placeholder = 'Elegí una opción',
  hint,
  error,
  onPress,
  style,
}: {
  label?: string;
  value?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  onPress?: () => void;
  style?: ViewStyle;
}) => {
  const theme = useTheme();
  const borderColor = error ? theme.colors.errFg : theme.colors.borderDefault;
  return (
    <View style={style}>
      {label ? (
        <Text
          style={{
            marginBottom: 6,
            fontFamily: theme.font.semibold,
            fontSize: theme.fontSize.caption,
            color: theme.colors.textPrimary,
          }}
        >
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          minHeight: 48,
          paddingHorizontal: 14,
          borderWidth: 1.5,
          borderColor,
          borderRadius: theme.radius.md,
          backgroundColor: pressed ? theme.colors.bgSunken : theme.colors.surfaceCard,
        })}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: theme.fontSize.body,
            fontFamily: theme.font.regular,
            color: value ? theme.colors.textPrimary : theme.colors.textTertiary,
          }}
        >
          {value || placeholder}
        </Text>
        <ChevronDown size={20} color={theme.colors.textTertiary} strokeWidth={2} />
      </Pressable>
      {error || hint ? (
        <Text
          style={{
            marginTop: 6,
            fontFamily: theme.font.regular,
            fontSize: theme.fontSize.caption,
            color: error ? theme.colors.errFg : theme.colors.textSecondary,
          }}
        >
          {error ?? hint}
        </Text>
      ) : null}
    </View>
  );
};
