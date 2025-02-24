import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';

/**
 * Common styles shared across ReciterProfile components
 */
export const createSharedStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: moderateScale(20),
      paddingTop: moderateScale(10),
    },
    toggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: moderateScale(10),
      paddingVertical: moderateScale(5),
      backgroundColor: theme.colors.background,
    },
    toggleLabel: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginRight: moderateScale(10),
    },
    text: {
      color: theme.colors.text,
      fontFamily: 'Manrope-Regular',
    },
    textBold: {
      color: theme.colors.text,
      fontFamily: 'Manrope-Bold',
    },
    textMedium: {
      color: theme.colors.text,
      fontFamily: 'Manrope-Medium',
    },
    textSecondary: {
      color: theme.colors.textSecondary,
      fontFamily: 'Manrope-Regular',
    },
  });
