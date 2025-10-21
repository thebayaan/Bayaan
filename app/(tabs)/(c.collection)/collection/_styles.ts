import {Theme} from '@/utils/themeUtils';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import Color from 'color';

export const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(15),
    },
    headerTitleContainer: {
      flex: 1,
    },
    headerTitle: {
      fontSize: moderateScale(28),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    subTitle: {
      fontSize: moderateScale(16),
      color: theme.colors.textSecondary,
      marginTop: moderateScale(5),
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: moderateScale(10),
      marginHorizontal: moderateScale(15),
    },
    playButton: {
      marginLeft: moderateScale(15),
    },
    downloadButton: {
      alignSelf: 'flex-start',
    },

    rightAlignedButtons: {
      flexDirection: 'row',
    },
    searchButton: {
      position: 'absolute',
      zIndex: 10,
    },
    iconButton: {
      marginLeft: moderateScale(15),
    },
    headerContent: {
      paddingTop: moderateScale(20),
      paddingHorizontal: moderateScale(20),
    },
    listContainer: {
      flexGrow: 1,
      paddingHorizontal: moderateScale(15),
      paddingTop: moderateScale(20),
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: verticalScale(10),
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    searchBarContainer: {
      paddingHorizontal: moderateScale(15),
      marginBottom: moderateScale(15),
    },
    gridContainer: {
      paddingHorizontal: moderateScale(15),
      paddingTop: moderateScale(15),
    },
    columnWrapper: {
      justifyContent: 'space-between',
      marginBottom: verticalScale(20),
    },
    emptyText: {
      fontSize: moderateScale(16),
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: verticalScale(20),
    },
    filterContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(15),
      marginBottom: moderateScale(15),
    },
    filterButton: {
      backgroundColor: theme.colors.card,
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(6),
      borderRadius: moderateScale(15),
    },
    filterText: {
      color: theme.colors.text,
      fontSize: moderateScale(12),
    },
    createPlaylistButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: moderateScale(15),
      marginBottom: moderateScale(20),
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: moderateScale(8),
      marginHorizontal: moderateScale(10),
    },
    createPlaylistText: {
      fontSize: moderateScale(16),
      color: theme.colors.primary,
      marginLeft: moderateScale(10),
    },
    gradient: {
      paddingBottom: moderateScale(20),
    },
    stickyHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
      paddingBottom: moderateScale(15),
      paddingHorizontal: moderateScale(20),
    },
    stickyHeaderTitle: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    contentContainer: {
      paddingBottom: moderateScale(10),
    },
    gradientContainer: {
      overflow: 'hidden',
    },
    backButton: {
      position: 'absolute',
      left: moderateScale(15),
      zIndex: 10,
    },
    listContentContainer: {
      paddingHorizontal: moderateScale(15),
    },
    clearButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(8),
      backgroundColor: Color(theme.colors.error).alpha(0.1).toString(),
      borderRadius: moderateScale(8),
      borderWidth: 1,
      borderColor: Color(theme.colors.error).alpha(0.3).toString(),
    },
    clearButtonText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.error,
      marginLeft: moderateScale(6),
    },
    clearButtonTextDisabled: {
      color: theme.colors.textSecondary,
    },
  });
