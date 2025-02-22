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
      paddingBottom: verticalScale(5),
    },
    contentContainer: {
      flex: 1,
    },
    searchBoxContainer: {
      backgroundColor: theme.colors.background,
      marginHorizontal: moderateScale(15),
      marginBottom: verticalScale(2),
      marginTop: verticalScale(10),
    },
    resultsContainer: {
      flex: 1,
      padding: moderateScale(15),
      paddingBottom: moderateScale(30),
    },
    sectionTitle: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: verticalScale(10),
    },
    emptyContainer: {
      flex: 1,
      paddingHorizontal: moderateScale(20),
    },
    placeholderSectionTitle: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
      marginTop: verticalScale(5),
      marginBottom: verticalScale(10),
      zIndex: 1,
    },
    searchSuggestionsContainer: {
      marginTop: verticalScale(10),
    },
    searchItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: verticalScale(10),
    },
    searchIconContainer: {
      marginRight: moderateScale(10),
    },
    searchItemText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
    },
    emptyText: {
      textAlign: 'center',
      marginTop: verticalScale(20),
      fontSize: moderateScale(16),
      color: theme.colors.text,
    },
    suggestionsContainer: {
      marginTop: verticalScale(2),
      marginBottom: verticalScale(10),
    },
    suggestionRow: {},
    suggestionRowContent: {
      paddingHorizontal: moderateScale(15),
    },
    suggestionButton: {
      marginRight: moderateScale(8),
      paddingHorizontal: moderateScale(8),
      paddingVertical: verticalScale(4),
      borderRadius: moderateScale(16),
      borderWidth: moderateScale(0.6),
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    suggestionButtonText: {
      fontSize: moderateScale(14),
    },
    recentSearchesHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: verticalScale(10),
    },
    clearButton: {
      color: theme.colors.textSecondary,
      fontSize: moderateScale(12),
    },
  });
