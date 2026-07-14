import { type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';

export const Screen = ({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) => {
  const theme = useTheme();
  const content = { padding: theme.spacing.screenPad, gap: theme.spacing.stackGap };
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
};

export const Title = ({ children }: { children: ReactNode }) => {
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
};

export const Subtitle = ({ children }: { children: ReactNode }) => {
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
};

export const Overline = ({ children }: { children: ReactNode }) => {
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
};

export const Label = ({ children }: { children: ReactNode }) => {
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
};

export const BodyText = ({ children }: { children: ReactNode }) => {
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
};

export const ErrorText = ({ children }: { children: ReactNode }) => {
  const theme = useTheme();
  if (!children) return null;
  return (
    <Text style={{ color: theme.colors.errFg, fontFamily: theme.font.regular, fontSize: theme.fontSize.caption }}>
      {children}
    </Text>
  );
};

export const Centered = ({ children }: { children: ReactNode }) => {
  const theme = useTheme();
  return <View style={[styles.centered, { padding: theme.spacing.xxl, gap: theme.spacing.lg }]}>{children}</View>;
};

export const Loading = () => {
  const theme = useTheme();
  return (
    <View style={[styles.flex, styles.center, { backgroundColor: theme.colors.bgApp }]}>
      <ActivityIndicator color={theme.colors.actionPrimary} size="large" />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
