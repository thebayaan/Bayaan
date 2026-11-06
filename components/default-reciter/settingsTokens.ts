// @ai-generated
import Color from 'color';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';

/**
 * The Settings look (solid inset cards, 12pt SemiBold sentence-case headers,
 * 14pt row titles, 8pt header-to-card, 22pt between sections). Mirrors
 * components/settings/SettingsList on the Settings restyle branch; switch to
 * that module's styles once it lands on develop.
 */
export const ROW_INSET = moderateScale(18);
export const HEADER_GAP = moderateScale(8);
export const SECTION_GAP = moderateScale(22);
export const CARD_RADIUS = moderateScale(24);

export function settingsTokens(theme: Theme) {
  const {mediumSize, smallSize} = theme.typography;
  const text = Color(theme.colors.text);
  return {
    mediumSize,
    smallSize,
    muted: text.alpha(0.55).toString(),
    secondary: text.alpha(0.5).toString(),
    cardColor: theme.isDarkMode
      ? Color('#ffffff').alpha(0.07).toString()
      : '#ffffff',
    separatorColor: text.alpha(0.14).toString(),
    header: {
      textAlign: 'left' as const,
      fontSize: smallSize,
      fontFamily: 'Manrope-SemiBold',
      color: text.alpha(0.55).toString(),
      marginBottom: HEADER_GAP,
      marginStart: ROW_INSET,
    },
  };
}
