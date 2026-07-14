import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { getPreference, preferenceKeys, removePreference, setPreference } from '@/lib/storage';

export type ColorScheme = 'light' | 'dark';
export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeModeState {
  mode: ThemeMode;
  scheme: ColorScheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeModeContext = createContext<ThemeModeState | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    getPreference(preferenceKeys.colorSchemeOverride).then((value) => {
      if (isThemeMode(value)) setModeState(value);
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    if (next === 'system') {
      void removePreference(preferenceKeys.colorSchemeOverride);
    } else {
      void setPreference(preferenceKeys.colorSchemeOverride, next);
    }
  }, []);

  const scheme: ColorScheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo<ThemeModeState>(() => ({ mode, scheme, setMode }), [mode, scheme, setMode]);

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode(): ThemeModeState {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode debe usarse dentro de <ThemeModeProvider>.');
  return ctx;
}
