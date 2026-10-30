import {Platform} from 'react-native';
import {isLiquidGlassAvailable} from 'expo-glass-effect';
import {useThemeStore} from '@/store/themeStore';
import {useTheme} from '@/hooks/useTheme'; // @ai

/** Whether the current device supports liquid glass (iOS 26+). */
export const USE_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

/**
 * Returns the `colorScheme` prop value that should be passed to every
 * `<GlassView>` so it matches the user's chosen theme instead of always
 * following the system appearance.
 *
 * Usage:
 * ```tsx
 * const glassColorScheme = useGlassColorScheme();
 * <GlassView colorScheme={glassColorScheme} glassEffectStyle="regular" />
 * ```
 */
export function useGlassColorScheme(): 'auto' | 'light' | 'dark' {
  const themeMode = useThemeStore(s => s.themeMode);
  if (themeMode === 'system') return 'auto';
  return themeMode; // 'light' | 'dark'
}

// @ai-start
/**
 * Dark wash laid over our own glass, as rgba alpha: plain `regular` glass
 * reads lighter than other apps'. Dark themes take 0.20; light themes 0.10,
 * since the page behind is lighter and a stronger wash turns grey.
 */
const GLASS_TINT_ALPHA = {dark: 0.2, light: 0.1};

/** `tintColor` for every GlassView we draw. */
export function useGlassTint(): string {
  const isDark = useTheme().theme.isDarkMode;
  return `rgba(0,0,0,${isDark ? GLASS_TINT_ALPHA.dark : GLASS_TINT_ALPHA.light})`;
}
// @ai-end
