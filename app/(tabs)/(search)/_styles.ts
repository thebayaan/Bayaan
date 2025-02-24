import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';

export function createStyles(theme: Theme) {
  return ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      overflow: 'hidden',
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    searchBoxContainer: {
      paddingBottom: moderateScale(12),
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: moderateScale(100),
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: moderateScale(24),
      marginBottom: moderateScale(12),
      paddingHorizontal: moderateScale(16),
    },
    sectionTitle: {
      fontSize: moderateScale(16),
      fontWeight: '600',
      color: theme.colors.text,
      letterSpacing: 0.5,
    },
    searchItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(16),
    },
    suggestionRow: {
      paddingHorizontal: moderateScale(12),
      marginBottom: moderateScale(8),
    },
    suggestionButton: {
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(8),
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(10),
      marginHorizontal: moderateScale(4),
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
      minWidth: moderateScale(60),
      height: moderateScale(44),
    },
    suggestionButtonText: {
      fontSize: moderateScale(14),
      color: theme.colors.text,
      marginLeft: moderateScale(8),
      fontFamily: theme.fonts.medium,
    },
    suggestionButtonNumber: {
      fontSize: moderateScale(13),
      color: theme.colors.text,
      marginLeft: moderateScale(8),
      fontFamily: theme.fonts.medium,
      opacity: 0.9,
    },
    suggestionButtonArabic: {
      fontSize: moderateScale(18),
      fontFamily: 'Amiri-Regular',
      color: theme.colors.text,
      marginLeft: moderateScale(8),
      textAlign: 'left',
    },
    suggestionButtonTranslation: {
      fontSize: moderateScale(13),
      color: theme.colors.text,
      marginLeft: moderateScale(8),
      fontFamily: theme.fonts.regular,
      opacity: 0.8,
    },
    searchIconContainer: {
      opacity: 0.7,
    },
    searchItemText: {
      fontSize: moderateScale(15),
      color: theme.colors.text,
      flex: 1,
    },
    clearButton: {
      fontSize: moderateScale(14),
      color: theme.colors.text,
      opacity: 0.7,
      fontWeight: '500',
    },
    resultsContainer: {
      paddingHorizontal: moderateScale(16),
      paddingTop: moderateScale(8),
      paddingBottom: moderateScale(100),
    },
    loadingContainer: {
      paddingVertical: moderateScale(20),
      alignItems: 'center',
    },
    emptyContainer: {
      paddingVertical: moderateScale(40),
      alignItems: 'center',
    },
    emptyText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
      fontWeight: '500',
      marginBottom: moderateScale(8),
    },
    emptySubtext: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    footer: {
      height: moderateScale(40),
    },
  });
}
