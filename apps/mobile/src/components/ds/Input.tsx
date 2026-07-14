import { forwardRef, useState, type ReactNode } from 'react';
import { Text, TextInput, View, type KeyboardTypeOptions, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export type InputProps = {
  label?: string;
  value?: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  mono?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secureTextEntry?: boolean;
  prefix?: string;
  suffix?: ReactNode;
  multiline?: boolean;
  style?: ViewStyle;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    value,
    onChangeText,
    placeholder,
    hint,
    error,
    mono = false,
    keyboardType,
    autoCapitalize,
    secureTextEntry,
    prefix,
    suffix,
    multiline = false,
    style,
  },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? theme.colors.errFg
    : focused
      ? theme.colors.borderFocus
      : theme.colors.borderDefault;
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
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: 8,
          minHeight: 48,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
          borderWidth: 1.5,
          borderColor,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceCard,
        }}
      >
        {prefix ? (
          <Text style={{ fontSize: theme.fontSize.body, color: theme.colors.textTertiary }}>{prefix}</Text>
        ) : null}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            minWidth: 0,
            paddingVertical: multiline ? 0 : 12,
            fontSize: theme.fontSize.body,
            fontFamily: mono ? theme.font.monoRegular : theme.font.regular,
            color: theme.colors.textPrimary,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {suffix}
      </View>
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
});
