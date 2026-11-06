// @ai-generated
import {useMemo} from 'react';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {isRTL} from '@/utils/rtl';

/**
 * The reading theme expressed in the terms an Expo UI `Host` understands.
 *
 * SwiftUI and Compose views don't see our theme object, so every `Host`
 * takes its color scheme, layout direction and tint from here. Controls tint
 * from `text` like the rest of the monochrome chrome (design-system §3);
 * backgrounds stay system-drawn.
 */
export interface NativeTheme {
  colorScheme: 'light' | 'dark';
  layoutDirection: 'leftToRight' | 'rightToLeft';
  /** Active tint for switches, sliders and selected segments. */
  tint: string;
  /** Switch track when on (`text` at 0.65, matching the old RN switches). */
  trackOn: string;
  /** Switch track when off, and a slider's unfilled track. */
  trackOff: string;
  /** Unfilled slider track. */
  sliderTrack: string;
  /** Text and icons inside native views. */
  text: string;
  error: string;
}

export function useNativeTheme(): NativeTheme {
  const {theme} = useTheme();
  return useMemo(() => {
    const text = theme.colors.text;
    return {
      colorScheme: theme.isDarkMode ? 'dark' : 'light',
      layoutDirection: isRTL ? 'rightToLeft' : 'leftToRight',
      tint: text,
      trackOn: Color(text).alpha(0.65).toString(),
      trackOff: Color(text).alpha(0.1).toString(),
      sliderTrack: Color(text).alpha(0.2).toString(),
      text,
      error: theme.colors.error,
    };
  }, [theme.isDarkMode, theme.colors.text, theme.colors.error]);
}
