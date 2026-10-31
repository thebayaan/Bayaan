// @ai-generated
import {useMemo} from 'react';
import {StyleSheet} from 'react-native';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';

/**
 * The Reading sheet's type and card styles, matching the Settings list:
 * solid cards (a faint tint on a light sheet, where white would vanish),
 * 24pt corners, rows of at least 56pt, sentence-case section headers.
 */

/** Row padding; headers and helper lines line up with row text at it. */
export const ROW_INSET = moderateScale(18);
/** Header to its card. */
export const HEADER_GAP = moderateScale(8);
/** A card (or tile row) to the next section's header. */
export const SECTION_GAP = moderateScale(22);
export const CARD_RADIUS = moderateScale(24);
export const ROW_MIN_HEIGHT = moderateScale(56);
/** Side padding of the sheet's content. */
export const PAGE_INSET = moderateScale(16);

export type OptionStyles = ReturnType<typeof createOptionStyles>;

export function useOptionStyles(): OptionStyles {
  const {theme} = useTheme();
  return useMemo(() => createOptionStyles(theme), [theme]);
}

/** The text color at `alpha`, for tints, lines and muted type. */
export function textAlpha(theme: Theme, alpha: number): string {
  return Color(theme.colors.text).alpha(alpha).toString();
}

export function createOptionStyles(theme: Theme) {
  // The theme's sizes are already scaled to the screen.
  const {mediumSize, smallSize, subheadingSize} = theme.typography;
  const muted = textAlpha(theme, 0.55);
  return StyleSheet.create({
    section: {
      marginBottom: SECTION_GAP,
    },
    header: {
      textAlign: 'left',
      fontSize: smallSize,
      fontFamily: 'Manrope-SemiBold',
      color: muted,
      marginBottom: HEADER_GAP,
      marginStart: ROW_INSET,
    },
    helper: {
      textAlign: 'left',
      fontSize: smallSize,
      fontFamily: 'Manrope-Regular',
      color: textAlpha(theme, 0.5),
      marginTop: HEADER_GAP,
      marginHorizontal: ROW_INSET,
      lineHeight: smallSize * 1.4,
    },
    card: {
      backgroundColor: theme.isDarkMode
        ? Color('#ffffff').alpha(0.07).toString()
        : textAlpha(theme, 0.05),
      borderRadius: CARD_RADIUS,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: ROW_MIN_HEIGHT,
      paddingHorizontal: ROW_INSET,
      paddingVertical: moderateScale(10),
      gap: moderateScale(12),
    },
    pressed: {
      backgroundColor: textAlpha(theme, 0.06),
    },
    disabled: {
      opacity: 0.42,
    },
    texts: {
      flex: 1,
      gap: moderateScale(2),
    },
    title: {
      textAlign: 'left',
      fontSize: mediumSize,
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    subtitle: {
      textAlign: 'left',
      fontSize: smallSize,
      fontFamily: 'Manrope-Regular',
      color: textAlpha(theme, 0.5),
      lineHeight: smallSize * 1.4,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: textAlpha(theme, 0.14),
      marginStart: ROW_INSET,
    },
    sheetTitle: {
      textAlign: 'left',
      fontSize: subheadingSize,
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    preview: {
      marginHorizontal: moderateScale(12),
      marginTop: moderateScale(4),
      marginBottom: moderateScale(4),
      borderRadius: moderateScale(14),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: textAlpha(theme, 0.1),
      backgroundColor: theme.colors.background,
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(8),
      overflow: 'hidden',
    },
  });
}
