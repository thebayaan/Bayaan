import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';

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
      paddingBottom: moderateScale(10),
    },
    optionsAndToggleRow: {
      height: moderateScale(40),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: moderateScale(16),
      borderRadius: moderateScale(8),
      marginBottom: moderateScale(2),
      backgroundColor: theme.colors.background,
      marginTop: moderateScale(10),
    },
    sortOptionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rightControlsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(6),
      paddingVertical: moderateScale(6),
      borderRadius: moderateScale(16),
      marginRight: moderateScale(8),
    },
    activeOptionButton: {
      backgroundColor: Color(theme.colors.primary).alpha(0.1).toString(),
    },
    optionButtonText: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-SemiBold',
      marginLeft: moderateScale(4),
      color: theme.colors.textSecondary,
    },
    activeOptionText: {
      color: theme.colors.primary,
    },
    viewModeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(6),
    },
    toggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    toggleLabel: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginRight: moderateScale(8),
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
