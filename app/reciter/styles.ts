import {Theme} from '@/utils/themeUtils';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {Dimensions} from 'react-native';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

export const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      height: SCREEN_HEIGHT * 0.4,
      width: '100%',
    },
    imageContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT * 0.4,
      backgroundColor: theme.colors.card,
    },
    reciterImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    placeholderContainer: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.card,
    },
    gradientOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '50%', // Increased the gradient height
    },
    backButton: {
      position: 'absolute',
      top: moderateScale(50), // Increased top padding
      left: moderateScale(20),
      padding: moderateScale(10),
      borderRadius: moderateScale(20),
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      zIndex: 10, // Ensure it's above other elements
    },
    reciterInfoOverlay: {
      position: 'absolute',
      bottom: moderateScale(20),
      left: moderateScale(20),
      right: moderateScale(20),
    },
    reciterName: {
      fontSize: moderateScale(24),
      fontWeight: 'bold',
      color: theme.colors.background,
      marginBottom: verticalScale(5),
    },
    reciterStyle: {
      fontSize: moderateScale(16),
      color: theme.colors.background,
    },
    contentContainer: {
      backgroundColor: theme.colors.background,
      paddingTop: moderateScale(20),
      paddingHorizontal: moderateScale(15),
    },
    profileInfo: {
      padding: moderateScale(20),
      alignItems: 'center',
    },
    surahList: {
      paddingHorizontal: moderateScale(15),
    },
    surahItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(15),
      paddingHorizontal: moderateScale(20),
    },
    surahNumberContainer: {
      width: 40,
      alignItems: 'center',
    },
    surahNumber: {
      fontSize: moderateScale(16),
      color: theme.colors.primary,
    },
    surahInfoContainer: {
      flex: 1,
      marginLeft: moderateScale(20),
    },
    surahName: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
      marginBottom: moderateScale(5),
    },
    surahSecondaryInfo: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
    },
    surahGlyphContainer: {
      flex: 0,
      alignItems: 'flex-end',
    },
    surahGlyph: {
      fontSize: moderateScale(24),
      fontFamily: 'surah_names',
      color: theme.colors.text,
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: moderateScale(20),
      paddingHorizontal: moderateScale(20),
    },
    rightAlignedButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButton: {
      width: moderateScale(56),
      height: moderateScale(56),
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
      borderRadius: moderateScale(28),
      marginHorizontal: moderateScale(5),
    },
    playButton: {
      backgroundColor: theme.colors.primary,
      width: moderateScale(56),
      height: moderateScale(56),
      borderRadius: moderateScale(28),
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.colors.light,
      marginLeft: moderateScale(10),
    },
    playButtonIcon: {
      marginLeft: 3,
    },
    stickyHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      zIndex: 1,
      paddingTop: moderateScale(40),
      paddingBottom: moderateScale(10),
      paddingHorizontal: moderateScale(10),
    },
    stickyReciterName: {
      fontSize: moderateScale(16),
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    searchBarContainer: {
      backgroundColor: theme.colors.background,
      paddingBottom: moderateScale(10),
    },
  });
