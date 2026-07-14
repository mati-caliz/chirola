import { useState } from 'react';
import { Search, X } from 'lucide-react-native';
import { Pressable, TextInput, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export const SearchBar = ({
  value,
  onChangeText,
  placeholder = 'Buscar',
  onClear,
  style,
}: {
  value?: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  style?: ViewStyle;
}) => {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          height: 44,
          paddingHorizontal: 12,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.bgSunken,
          borderWidth: 1.5,
          borderColor: focused ? theme.colors.borderFocus : 'transparent',
        },
        style,
      ]}
    >
      <Search size={18} color={theme.colors.textTertiary} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: theme.fontSize.body,
          fontFamily: theme.font.regular,
          color: theme.colors.textPrimary,
        }}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Borrar búsqueda"
          onPress={onClear}
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.borderStrong,
          }}
        >
          <X size={12} color={theme.colors.surfaceCard} strokeWidth={3} />
        </Pressable>
      ) : null}
    </View>
  );
};
