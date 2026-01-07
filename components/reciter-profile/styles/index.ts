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
    localActionsRow: {
      paddingHorizontal: moderateScale(20),
      paddingVertical: moderateScale(6),
    },
    localActionButton: {
      paddingVertical: moderateScale(10),
      paddingHorizontal: moderateScale(14),
      borderRadius: moderateScale(10),
      backgroundColor: Color(theme.colors.primary).alpha(0.08).toString(),
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: Color(theme.colors.primary).alpha(0.3).toString(),
    },
    localActionText: {
      color: theme.colors.primary,
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(13),
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: Color('#000').alpha(0.4).toString(),
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(16),
      borderTopRightRadius: moderateScale(16),
      padding: moderateScale(16),
      minHeight: moderateScale(320),
    },
    modalTitle: {
      fontFamily: 'Manrope-Bold',
      fontSize: moderateScale(16),
      color: theme.colors.text,
      marginBottom: moderateScale(8),
    },
    modalLabel: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(13),
      color: theme.colors.textSecondary,
      marginBottom: moderateScale(6),
      marginTop: moderateScale(8),
    },
    modalInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: moderateScale(10),
      padding: moderateScale(10),
      fontSize: moderateScale(14),
      marginBottom: moderateScale(10),
      backgroundColor: theme.colors.card,
      color: theme.colors.text,
    },
    modalInputFlex: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: moderateScale(10),
      padding: moderateScale(10),
      fontSize: moderateScale(14),
      marginBottom: moderateScale(8),
      backgroundColor: theme.colors.card,
      color: theme.colors.text,
      flex: 1,
    },
    modalList: {
      maxHeight: moderateScale(200),
      marginBottom: moderateScale(8),
    },
    modalListContent: {
      paddingBottom: moderateScale(4),
    },
    modalTabRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
      marginBottom: moderateScale(8),
    },
    modalRemove: {
      padding: moderateScale(8),
    },
    modalAddRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: moderateScale(4),
      marginBottom: moderateScale(12),
    },
    modalAddButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: moderateScale(10),
      paddingHorizontal: moderateScale(14),
      borderRadius: moderateScale(10),
    },
    modalAddText: {
      color: theme.colors.background,
      fontFamily: 'Manrope-SemiBold',
    },
    modalActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(10),
    },
    modalButton: {
      flex: 1,
      paddingVertical: moderateScale(12),
      alignItems: 'center',
      borderRadius: moderateScale(10),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalCancel: {
      backgroundColor: theme.colors.card,
    },
    modalSave: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    modalButtonText: {
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    modalSaveText: {
      color: theme.colors.background,
    },
  });
