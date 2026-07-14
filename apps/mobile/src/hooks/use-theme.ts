import {
  darkColors,
  darkShadows,
  fontFamily,
  fontSize,
  lightColors,
  lightShadows,
  lineHeight,
  radius,
  spacing,
  type ShadowSet,
  type ThemeColors,
} from '@/theme/tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ColorScheme = 'light' | 'dark';

export type Theme = {
  scheme: ColorScheme;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  font: typeof fontFamily;
  shadow: ShadowSet;
};

const lightTheme: Theme = {
  scheme: 'light',
  colors: lightColors,
  spacing,
  radius,
  fontSize,
  lineHeight,
  font: fontFamily,
  shadow: lightShadows,
};

const darkTheme: Theme = {
  scheme: 'dark',
  colors: darkColors,
  spacing,
  radius,
  fontSize,
  lineHeight,
  font: fontFamily,
  shadow: darkShadows,
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}
