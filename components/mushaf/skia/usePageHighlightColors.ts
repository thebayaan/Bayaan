// @ai-generated
/**
 * The playback and selection tints of a DigitalKhatt page (SkiaPage,
 * MushafPageContent): the text colour, lighter in dark mode.
 */
import {useMemo} from 'react';
import Color from 'color';

export interface PageHighlightColors {
  playbackBgColor: string;
  selectionBgColor: string;
}

export function usePageHighlightColors(
  textColor: string,
  isDarkMode: boolean,
): PageHighlightColors {
  return useMemo(
    () => ({
      playbackBgColor: Color(textColor)
        .alpha(isDarkMode ? 0.1 : 0.12)
        .toString(),
      selectionBgColor: Color(textColor)
        .alpha(isDarkMode ? 0.15 : 0.18)
        .toString(),
    }),
    [textColor, isDarkMode],
  );
}
