// @ai-generated
import {useMemo} from 'react';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {Theme} from '@/utils/themeUtils';
import {latinLetterSpacing} from '@/utils/rtl';

// Styles shared by the translations and tafaseer picker lists.
const createPickerStyles = (theme: Theme) =>
  ScaledSheet.create({
    // Fabric mirrors logical left alignment in RTL. Explicitly use the
    // leading edge for catalogue text rather than native 'natural' alignment.
    // Section headers — meta (ACTIVE TRANSLATION)
    metaHeaderContainer: {
      paddingHorizontal: moderateScale(18),
      paddingTop: moderateScale(12),
      paddingBottom: moderateScale(6),
    },
    metaHeader: {
      textAlign: 'left',
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: latinLetterSpacing(1.2),
      textTransform: 'uppercase',
    },

    // Section headers — language group (ENGLISH, ARABIC)
    langHeaderContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(18),
      paddingTop: moderateScale(20),
      paddingBottom: moderateScale(8),
      gap: moderateScale(6),
    },
    langHeader: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: latinLetterSpacing(1.2),
      textTransform: 'uppercase',
    },
    langCount: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.textSecondary).alpha(0.35).toString(),
    },

    // Active card
    activeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: moderateScale(16),
      padding: moderateScale(14),
      borderRadius: moderateScale(14),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    activeCardText: {
      flex: 1,
    },
    activeCardName: {
      textAlign: 'left',
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },
    activeCardLanguage: {
      textAlign: 'left',
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      marginTop: moderateScale(2),
    },
    activeBadge: {
      paddingHorizontal: moderateScale(10),
      paddingVertical: moderateScale(4),
      borderRadius: moderateScale(8),
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    activeBadgeText: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.55).toString(),
      letterSpacing: latinLetterSpacing(0.3),
    },

    searchContainer: {
      paddingHorizontal: moderateScale(16),
      paddingTop: moderateScale(12),
    },

    // Card grouping
    cardRow: {
      marginHorizontal: moderateScale(16),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      overflow: 'hidden',
    },
    cardRowFirst: {
      borderTopWidth: 1,
      borderTopLeftRadius: moderateScale(12),
      borderTopRightRadius: moderateScale(12),
    },
    cardRowLast: {
      borderBottomWidth: 1,
      borderBottomLeftRadius: moderateScale(12),
      borderBottomRightRadius: moderateScale(12),
    },
    cardRowMiddle: {},
    cardRowOnly: {
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderRadius: moderateScale(12),
    },
    cardDivider: {
      height: 1,
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginHorizontal: moderateScale(14),
    },

    // Rows
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(14),
    },
    rowPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    rowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
    },
    deleteButton: {
      padding: moderateScale(6),
      borderRadius: moderateScale(8),
      marginLeft: moderateScale(6),
    },
    rowContent: {
      flex: 1,
      marginRight: moderateScale(10),
    },
    rowName: {
      textAlign: 'left',
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },
    rowNameActive: {
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    rowNativeName: {
      textAlign: 'left',
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      marginTop: moderateScale(1),
    },

    // Selected dot indicator
    selectedDot: {
      width: moderateScale(8),
      height: moderateScale(8),
      borderRadius: moderateScale(4),
      backgroundColor: theme.colors.text,
    },

    // Progress
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
    },
    progressText: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
    },

    // Empty
    emptyText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      textAlign: 'center',
      paddingVertical: moderateScale(20),
    },
  });

export type PickerStyles = ReturnType<typeof createPickerStyles>;

export function usePickerStyles(): PickerStyles {
  const {theme} = useTheme();
  return useMemo(() => createPickerStyles(theme), [theme]);
}
