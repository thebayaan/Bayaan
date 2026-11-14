// @ai-generated
/**
 * Styles shared by the word-study sections (docs/design/ipad-standards.md):
 * - Arabic data (glosses, words, the standard spelling) in Scheherazade New
 *   at the long-form reading size (16 phone, 18 tablet) with a line pitch of
 *   2.0x, on the physical right as the i'rab text is;
 * - titles at the ramp's callout role, labels and source lines at footnote,
 *   in the Manrope families (IBM Plex Sans Arabic in Arabic);
 * - secondary text at alpha 0.85, the card fill of the morphology block.
 */
import {useMemo} from 'react';
import {StyleSheet} from 'react-native';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {useResponsive} from '@/hooks/useResponsive';
import {moderateScale} from '@/utils/scale';
import {isRTL} from '@/utils/rtl';
import {Theme} from '@/utils/themeUtils';

export const ARABIC_FONT = 'ScheherazadeNew-Regular';
export const ARABIC_FONT_BOLD = 'ScheherazadeNew-SemiBold';

/** The physical right: React Native swaps left and right in an RTL app. */
const RIGHT = isRTL ? 'left' : 'right';

export function useWordStudyStyles() {
  const {theme} = useTheme();
  const {isTablet} = useResponsive();
  return useMemo(() => createStyles(theme, isTablet), [theme, isTablet]);
}

export type WordStudyStyles = ReturnType<typeof createStyles>;

function createStyles(theme: Theme, isTablet: boolean) {
  const reading = isTablet ? 18 : 16;
  const callout = isTablet ? 15 : 14;
  const footnote = 13;
  const secondary = Color(theme.colors.textSecondary).alpha(0.85).toString();
  return StyleSheet.create({
    section: {
      marginTop: moderateScale(12),
      borderRadius: moderateScale(10),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(8),
    },
    title: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(callout),
      lineHeight: moderateScale(callout * 1.3),
      color: theme.colors.text,
      marginBottom: moderateScale(4),
    },
    entry: {
      paddingVertical: moderateScale(4),
    },
    entryBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    arabic: {
      fontFamily: ARABIC_FONT,
      fontSize: moderateScale(reading),
      lineHeight: moderateScale(reading * 2),
      color: theme.colors.text,
      textAlign: RIGHT,
      writingDirection: 'rtl',
    },
    arabicBold: {
      fontFamily: ARABIC_FONT_BOLD,
    },
    bookLine: {
      fontFamily: ARABIC_FONT,
      fontSize: moderateScale(callout),
      lineHeight: moderateScale(callout * 2),
      color: secondary,
      textAlign: RIGHT,
      writingDirection: 'rtl',
    },
    more: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(footnote),
      lineHeight: moderateScale(footnote * 1.45),
      color: theme.colors.text,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
    },
    label: {
      minWidth: moderateScale(72),
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(footnote),
      lineHeight: moderateScale(footnote * 1.45),
      color: secondary,
    },
    value: {
      flex: 1,
      fontFamily: ARABIC_FONT,
      fontSize: moderateScale(reading),
      lineHeight: moderateScale(reading * 2),
      color: theme.colors.text,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    mark: {
      fontFamily: ARABIC_FONT_BOLD,
      color: theme.colors.primary,
    },
    note: {
      fontFamily: 'Manrope-Regular',
      fontSize: moderateScale(callout),
      lineHeight: moderateScale(callout * 1.45),
      color: theme.colors.text,
      marginTop: moderateScale(4),
    },
    noteKind: {
      fontFamily: 'Manrope-SemiBold',
    },
    source: {
      fontFamily: 'Manrope-Regular',
      fontSize: moderateScale(footnote),
      lineHeight: moderateScale(footnote * 1.45),
      color: secondary,
      marginTop: moderateScale(8),
    },
  });
}
