import {ScaledSheet, moderateScale, verticalScale} from '@/utils/scale';
import {Theme} from '@/styles/theme';

export const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      backgroundColor: theme.colors.background,
      paddingBottom: verticalScale(5),
    },
    listContainer: {
      paddingHorizontal: moderateScale(15),
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(15),
    },
    listItemText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
      marginLeft: moderateScale(15),
      flex: 1,
    },
  });
