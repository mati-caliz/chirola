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
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const BRAND = '#208AEF';

/** Contenedor de pantalla con safe area y scroll. */
export function Screen({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  const c = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.flexContent}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]} edges={['bottom']}>
      {body}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const c = useTheme();
  return <Text style={[styles.title, { color: c.text }]}>{children}</Text>;
}

export function Subtitle({ children }: { children: ReactNode }) {
  const c = useTheme();
  return <Text style={[styles.subtitle, { color: c.textSecondary }]}>{children}</Text>;
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const c = useTheme();
  const inner = <View style={[styles.card, { backgroundColor: c.backgroundElement }]}>{children}</View>;
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

export function Label({ children }: { children: ReactNode }) {
  const c = useTheme();
  return <Text style={[styles.label, { color: c.textSecondary }]}>{children}</Text>;
}

export function BodyText({ children }: { children: ReactNode }) {
  const c = useTheme();
  return <Text style={{ color: c.text }}>{children}</Text>;
}

export const TextField = forwardRef<TextInput, TextInputProps & { label?: string }>(
  function TextField({ label, style, ...props }, ref) {
    const c = useTheme();
    return (
      <View style={styles.field}>
        {label ? <Label>{label}</Label> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={c.textSecondary}
          style={[
            styles.input,
            { backgroundColor: c.backgroundElement, color: c.text, borderColor: c.backgroundSelected },
            style,
          ]}
          {...props}
        />
      </View>
    );
  },
);

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
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const c = useTheme();
  const isDisabled = disabled || loading;
  const bg =
    variant === 'primary' ? BRAND : variant === 'danger' ? '#E5484D' : c.backgroundSelected;
  const fg = variant === 'secondary' ? c.text : '#ffffff';
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

/** Estado centrado (cargando / vacío / error). */
export function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

export function Loading() {
  return (
    <Centered>
      <ActivityIndicator color={BRAND} size="large" />
    </Centered>
  );
}

/** Chip de estado de color (para CAE / vencimiento de cert, etc.). */
export function Badge({ text, tone = 'neutral' }: { text: string; tone?: 'ok' | 'warn' | 'neutral' }) {
  const bg = tone === 'ok' ? '#DFF5E1' : tone === 'warn' ? '#FDECEC' : '#E6EDF5';
  const fg = tone === 'ok' ? '#137333' : tone === 'warn' ? '#B3261E' : '#274060';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

/** Selector de una opción entre varias (chips). */
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
  const c = useTheme();
  return (
    <View style={styles.field}>
      {label ? <Label>{label}</Label> : null}
      <View style={styles.optionRow}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => onChange(opt.value)}
              style={[
                styles.option,
                {
                  backgroundColor: selected ? BRAND : c.backgroundElement,
                  borderColor: selected ? BRAND : c.backgroundSelected,
                },
              ]}
            >
              <Text style={{ color: selected ? '#fff' : c.text, fontWeight: '600', fontSize: 14 }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const brandColor = BRAND;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { padding: Spacing.three, gap: Spacing.three },
  flexContent: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 15 },
  card: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  pressed: { opacity: 0.7 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.one },
  field: { gap: Spacing.one },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
  button: {
    borderRadius: 10,
    paddingVertical: Spacing.three - 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  error: { color: '#E5484D', fontSize: 14 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  badge: { borderRadius: 999, paddingHorizontal: Spacing.two + 2, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
});
