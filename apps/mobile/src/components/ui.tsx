import { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { Button as DsButton, type ButtonVariant } from '@/components/ds/Button';
import { useTheme } from '@/hooks/use-theme';
import { palette } from '@/theme/tokens';

export {
  Screen,
  Title,
  Subtitle,
  Overline,
  Label,
  BodyText,
  ErrorText,
  Centered,
  Loading,
} from '@/components/ds/Text';
export { Card } from '@/components/ds/Card';
export { StatusBadge } from '@/components/ds/StatusBadge';
export { Amount } from '@/components/ds/Amount';

export const brandColor = palette.brand700;

export const Button = ({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
}) => (
  <DsButton variant={variant} full loading={loading} disabled={disabled} onPress={onPress}>
    {title}
  </DsButton>
);

export const TextField = forwardRef<TextInput, TextInputProps & { label?: string }>(function TextField(
  { label, style, ...props },
  ref,
) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {label ? (
        <Text
          style={{
            marginBottom: theme.spacing.xs,
            fontFamily: theme.font.semibold,
            fontSize: theme.fontSize.caption,
            color: theme.colors.textPrimary,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={theme.colors.textTertiary}
        style={[
          {
            borderWidth: 1.5,
            borderColor: theme.colors.borderDefault,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            fontSize: theme.fontSize.body,
            fontFamily: theme.font.regular,
            backgroundColor: theme.colors.surfaceCard,
            color: theme.colors.textPrimary,
            minHeight: theme.spacing.hitTarget,
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
});

export const Badge = ({ text, tone = 'neutral' }: { text: string; tone?: 'ok' | 'warn' | 'neutral' }) => {
  const theme = useTheme();
  const { colors } = theme;
  const map = {
    ok: { bg: colors.statusAprobadoBg, fg: colors.statusAprobadoFg },
    warn: { bg: colors.statusRechazadoBg, fg: colors.statusRechazadoFg },
    neutral: { bg: colors.statusPendienteBg, fg: colors.statusPendienteFg },
  } as const;
  const { bg, fg } = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderRadius: theme.radius.pill }]}>
      <Text style={{ color: fg, fontFamily: theme.font.semibold, fontSize: theme.fontSize.caption }}>{text}</Text>
    </View>
  );
};

export const OptionGroup = <T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}) => {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View style={styles.field}>
      {label ? (
        <Text
          style={{
            marginBottom: theme.spacing.xs,
            fontFamily: theme.font.semibold,
            fontSize: theme.fontSize.caption,
            color: theme.colors.textPrimary,
          }}
        >
          {label}
        </Text>
      ) : null}
      <View style={styles.optionRow}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => onChange(opt.value)}
              style={({ pressed }) => [
                styles.option,
                {
                  borderRadius: theme.radius.pill,
                  backgroundColor: selected ? colors.actionPrimary : colors.surfaceCard,
                  borderColor: selected ? colors.actionPrimary : colors.borderDefault,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? colors.actionPrimaryText : colors.textPrimary,
                  fontFamily: theme.font.semibold,
                  fontSize: theme.fontSize.callout,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  field: { gap: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 10 },
});
