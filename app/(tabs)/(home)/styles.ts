import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {Theme} from '@/styles/theme';

export const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(15),
      paddingTop: verticalScale(5),
    },
    headerTitle: {
      fontSize: moderateScale(24),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    settingsIcon: {
      padding: moderateScale(8),
      width: moderateScale(40),
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggleContainer: {
      flex: 1,
      alignItems: 'center',
    },
    leftPlaceholder: {
      width: moderateScale(24),
    },
  });
