import { forwardRef, useState, type ReactNode } from "react";
import {
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useTheme, type Theme } from "@/hooks/use-theme";
import { hasText } from "@chirola/shared";

const FIELD_VERTICAL_PADDING = 12;

export interface InputProps {
  label?: string;
  value?: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  mono?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  secureTextEntry?: boolean;
  prefix?: string;
  suffix?: ReactNode;
  multiline?: boolean;
  style?: ViewStyle;
}

function inputBorderColor(theme: Theme, hasError: boolean, focused: boolean): string {
  if (hasError) return theme.colors.errFg;
  return focused ? theme.colors.borderFocus : theme.colors.borderDefault;
}

function fieldBoxStyle(theme: Theme, multiline: boolean, borderColor: string): ViewStyle {
  return {
    flexDirection: "row",
    alignItems: multiline ? "flex-start" : "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: multiline ? FIELD_VERTICAL_PADDING : 0,
    borderWidth: 1.5,
    borderColor,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceCard,
  };
}

function textInputStyle(theme: Theme, multiline: boolean, mono: boolean): TextStyle {
  return {
    flex: 1,
    minWidth: 0,
    paddingVertical: multiline ? 0 : FIELD_VERTICAL_PADDING,
    fontSize: theme.fontSize.body,
    fontFamily: mono ? theme.font.monoRegular : theme.font.regular,
    color: theme.colors.textPrimary,
    textAlignVertical: multiline ? "top" : "center",
  };
}

const InputLabel = ({ label }: Readonly<{ label: string | undefined }>): ReactNode => {
  const theme = useTheme();
  if (!hasText(label)) return null;
  return (
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
  );
};

const InputFeedback = ({
  error,
  hint,
}: Readonly<{ error: string | undefined; hint: string | undefined }>): ReactNode => {
  const theme = useTheme();
  if (!hasText(error) && !hasText(hint)) return null;
  return (
    <Text
      style={{
        marginTop: 6,
        fontFamily: theme.font.regular,
        fontSize: theme.fontSize.caption,
        color: hasText(error) ? theme.colors.errFg : theme.colors.textSecondary,
      }}
    >
      {error ?? hint}
    </Text>
  );
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
  const borderColor = inputBorderColor(theme, hasText(error), focused);
  return (
    <View style={style}>
      <InputLabel label={label} />
      <View style={fieldBoxStyle(theme, multiline, borderColor)}>
        {hasText(prefix) ? (
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
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          style={textInputStyle(theme, multiline, mono)}
        />
        {suffix}
      </View>
      <InputFeedback error={error} hint={hint} />
    </View>
  );
});
