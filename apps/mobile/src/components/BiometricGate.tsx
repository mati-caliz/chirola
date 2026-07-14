import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Fingerprint } from 'lucide-react-native';
import { AppState, Text, View } from 'react-native';
import { Button } from '@/components/ds';
import { authenticateBiometric, isBiometricLockEnabled } from '@/lib/biometrics';
import { useTheme } from '@/hooks/use-theme';

export function BiometricGate({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const appState = useRef(AppState.currentState);

  const runAuth = useCallback(async () => {
    const ok = await authenticateBiometric();
    setUnlocked(ok);
  }, []);

  useEffect(() => {
    isBiometricLockEnabled().then((on) => {
      setEnabled(on);
      if (on) {
        void runAuth();
      } else {
        setUnlocked(true);
      }
    });
  }, [runAuth]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const cameToForeground = /inactive|background/.test(appState.current) && next === 'active';
      if (cameToForeground && enabled) {
        setUnlocked(false);
        void runAuth();
      }
      appState.current = next;
    });
    return () => subscription.remove();
  }, [enabled, runAuth]);

  const covered = enabled === null || (enabled && !unlocked);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {covered ? <LockOverlay showRetry={enabled === true} onRetry={runAuth} /> : null}
    </View>
  );
}

const LockOverlay = ({ showRetry, onRetry }: { showRetry: boolean; onRetry: () => void }) => {
  const theme = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.colors.bgApp,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 32,
      }}
    >
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: theme.colors.surfaceBrandSubtle, alignItems: 'center', justifyContent: 'center' }}>
        <Fingerprint size={44} color={theme.colors.textBrand} strokeWidth={1.75} />
      </View>
      <Text style={{ fontFamily: theme.font.extrabold, fontSize: theme.fontSize.heading, color: theme.colors.textPrimary }}>
        Chirola está bloqueada
      </Text>
      {showRetry ? (
        <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary, textAlign: 'center' }}>
          Desbloqueá con tu huella o rostro para continuar.
        </Text>
      ) : null}
      {showRetry ? (
        <Button variant="primary" onPress={onRetry}>
          Desbloquear
        </Button>
      ) : null}
    </View>
  );
};
