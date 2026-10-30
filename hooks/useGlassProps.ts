import {Platform, Settings} from 'react-native';
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
 * Dark wash laid over our own glass, as alpha: other apps' glass reads
 * darker than plain `regular` glass. Light themes get a subtler wash. The
 * experiment build takes `-BayaanGlassTint <dark alpha>` as a launch
 * argument so strengths can be compared without a rebuild.
 */
const GLASS_TINT_DARK = 0.16;
const GLASS_TINT_LIGHT_RATIO = 0.5;

function glassTintOverride(): number | undefined {
  if (Platform.OS !== 'ios') return undefined;
  const value: unknown = Settings.get('BayaanGlassTint');
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed)
    ? parsed
    : undefined;
}

const darkAlpha = glassTintOverride() ?? GLASS_TINT_DARK;

/** `tintColor` for every GlassView we draw, or undefined for none. */
export function useGlassTint(): string | undefined {
  const isDark = useTheme().theme.isDarkMode;
  const alpha = isDark ? darkAlpha : darkAlpha * GLASS_TINT_LIGHT_RATIO;
  return alpha > 0 ? `rgba(0,0,0,${alpha})` : undefined;
}
// @ai-end
