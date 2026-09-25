import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import { getPreference, preferenceKeys, removePreference, setPreference } from "@/lib/storage";

export type ColorScheme = "light" | "dark";
export type ThemeMode = "system" | "light" | "dark";

interface ThemeModeState {
  mode: ThemeMode;
  scheme: ColorScheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeModeContext = createContext<ThemeModeState | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function resolveColorScheme(mode: ThemeMode, systemScheme: string | null | undefined): ColorScheme {
  if (mode !== "system") return mode;
  return systemScheme === "dark" ? "dark" : "light";
}

export function ThemeModeProvider({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  const systemScheme = useSystemColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    void getPreference(preferenceKeys.colorSchemeOverride).then((value) => {
      if (isThemeMode(value)) setModeState(value);
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    if (next === "system") {
      void removePreference(preferenceKeys.colorSchemeOverride);
    } else {
      void setPreference(preferenceKeys.colorSchemeOverride, next);
    }
  }, []);

  const scheme = resolveColorScheme(mode, systemScheme);

  const value = useMemo<ThemeModeState>(() => ({ mode, scheme, setMode }), [mode, scheme, setMode]);

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode(): ThemeModeState {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode debe usarse dentro de <ThemeModeProvider>.");
  return ctx;
}
