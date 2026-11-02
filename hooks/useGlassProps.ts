import {Platform} from 'react-native';
import {isLiquidGlassAvailable} from 'expo-glass-effect';
import {useThemeStore} from '@/store/themeStore';
import {useTheme} from '@/hooks/useTheme'; // @ai
import {useGlassTintStore} from '@/store/glassTintStore'; // @ai

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
 * `tintColor` for every GlassView we draw: a dark wash, since plain
 * `regular` glass reads lighter than other apps'. The alpha per theme lives
 * in store/glassTintStore.
 */
export function useGlassTint(): string {
  const isDark = useTheme().theme.isDarkMode;
  const alpha = useGlassTintStore(s => (isDark ? s.dark : s.light));
  return `rgba(0,0,0,${alpha})`;
}
// @ai-end
