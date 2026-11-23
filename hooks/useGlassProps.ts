import {Platform} from 'react-native';
import {isLiquidGlassAvailable} from 'expo-glass-effect';
import {useThemeStore} from '@/store/themeStore';
import {useTheme} from '@/hooks/useTheme'; // @ai
import {
  DEFAULT_GLASS_TINT_ALPHA,
  useGlassTintStore,
} from '@/store/glassTintStore'; // @ai

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
 * reads lighter than other apps'. The settled values (0.20 dark, plain glass
 * in light); the tint dial can change them on a device (store/glassTintStore).
 */
export const GLASS_TINT_ALPHA = DEFAULT_GLASS_TINT_ALPHA;

/** `tintColor` for every GlassView we draw, from the tint dial's value. */
export function useGlassTint(): string {
  const isDark = useTheme().theme.isDarkMode;
  const alpha = useGlassTintStore(s => (isDark ? s.dark : s.light));
  return `rgba(0,0,0,${alpha})`;
}
// @ai-end
