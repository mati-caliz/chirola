import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '@/hooks/use-theme';
import { palette } from '@/theme/tokens';

export const brandColor = palette.brand700;

export function Screen({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  const theme = useTheme();
  const { spacing } = theme;
  const content = { padding: spacing.screenPad, gap: spacing.stackGap };
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.grow, content]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, content]}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bgApp }]} edges={['bottom']}>
      {body}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.textPrimary,
        fontFamily: theme.font.extrabold,
        fontSize: theme.fontSize.title,
        lineHeight: theme.fontSize.title * theme.lineHeight.tight,
      }}
    >
      {children}
    </Text>
  );
}

export function Subtitle({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.textSecondary,
        fontFamily: theme.font.regular,
        fontSize: theme.fontSize.callout,
        lineHeight: theme.fontSize.callout * theme.lineHeight.body,
      }}
    >
      {children}
    </Text>
  );
}

export function Overline({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.textTertiary,
        fontFamily: theme.font.semibold,
        fontSize: theme.fontSize.micro,
        letterSpacing: 0.66,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const theme = useTheme();
  const cardStyle = {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderWidth: theme.scheme === 'dark' ? StyleSheet.hairlineWidth : 0,
    borderColor: theme.colors.borderSubtle,
    ...theme.shadow.card,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          pressed ? { backgroundColor: theme.colors.bgSunken, transform: [{ scale: 0.99 }] } : null,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.textSecondary,
        fontFamily: theme.font.semibold,
        fontSize: theme.fontSize.caption,
        marginBottom: theme.spacing.xs,
      }}
    >
      {children}
    </Text>
  );
}

export function BodyText({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.textPrimary,
        fontFamily: theme.font.regular,
        fontSize: theme.fontSize.body,
        lineHeight: theme.fontSize.body * theme.lineHeight.body,
      }}
    >
      {children}
    </Text>
  );
}

export const TextField = forwardRef<TextInput, TextInputProps & { label?: string }>(
  function TextField({ label, style, ...props }, ref) {
    const theme = useTheme();
    return (
      <View style={{ gap: theme.spacing.xs }}>
        {label ? <Label>{label}</Label> : null}
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
  },
);

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

function buttonColors(theme: Theme, variant: ButtonVariant) {
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

export function Button({
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
}) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const { bg, press, fg } = buttonColors(theme, variant);
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? press : bg,
          borderRadius: theme.radius.pill,
          opacity: isDisabled ? 0.45 : 1,
          transform: pressed && !isDisabled ? [{ scale: 0.97 }] : [{ scale: 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontFamily: theme.font.semibold, fontSize: theme.fontSize.subhead }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const theme = useTheme();
  if (!children) return null;
  return (
    <Text style={{ color: theme.colors.errFg, fontFamily: theme.font.regular, fontSize: theme.fontSize.caption }}>
      {children}
    </Text>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.centered, { padding: theme.spacing.xxl, gap: theme.spacing.lg }]}>{children}</View>;
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={[styles.flex, styles.center, { backgroundColor: theme.colors.bgApp }]}>
      <ActivityIndicator color={theme.colors.actionPrimary} size="large" />
    </View>
  );
}

type BadgeTone = 'ok' | 'warn' | 'neutral';

export function Badge({ text, tone = 'neutral' }: { text: string; tone?: BadgeTone }) {
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
}

export function OptionGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View style={{ gap: theme.spacing.xs }}>
      {label ? <Label>{label}</Label> : null}
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
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 10 },
});
