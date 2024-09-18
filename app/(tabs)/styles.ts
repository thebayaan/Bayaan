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
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: moderateScale(15),
      paddingVertical: verticalScale(5),
    },
    headerTitle: {
      fontSize: moderateScale(24),
      fontWeight: 'bold',
      color: theme.colors.text,
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
    },
    sectionTitle: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: verticalScale(10),
    },
    emptyContainer: {
      flex: 1,
      padding: moderateScale(20),
    },
    placeholderSectionTitle: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
      marginTop: verticalScale(5),
      marginBottom: verticalScale(10),
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
    settingsIcon: {
      padding: moderateScale(10),
    },
    scrollContainer: {
      padding: moderateScale(20),
    },
    subtitle: {
      fontSize: moderateScale(16),
      marginBottom: verticalScale(10),
    },
    toggleContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      paddingBottom: verticalScale(10),
    },
    toggleButton: {
      paddingVertical: verticalScale(8),
      paddingHorizontal: moderateScale(16),
      borderRadius: moderateScale(25),
      marginHorizontal: moderateScale(4),
    },
    activeToggleButton: {
      backgroundColor: theme.colors.card,
      borderWidth: moderateScale(0.4),
      borderColor: theme.colors.border,
    },
    toggleButtonText: {
      fontSize: moderateScale(16),
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    activeToggleButtonText: {
      color: theme.colors.text,
    },
    suggestionsContainer: {
      marginTop: verticalScale(2),
      marginBottom: verticalScale(2),
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
  });
