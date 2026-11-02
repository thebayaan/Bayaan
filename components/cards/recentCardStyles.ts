// Styles of the Quran recent card (RecentReciterCard), shared with the adhkar
// card in Continue Listening (AdhkarSessionCard) so both render the same.
import {StyleSheet} from 'react-native';
import {moderateScale} from '@/utils/scale';
import Color from 'color';
import {latinLetterSpacing} from '@/utils/rtl';

export const RECENT_CARD_WIDTH = moderateScale(120);

export function createStyles(theme: {
  colors: {
    border: string;
    card: string;
    shadow: string;
    text: string;
    textSecondary: string;
    background: string;
  };
}) {
  return StyleSheet.create({
    container: {
      width: RECENT_CARD_WIDTH,
      borderRadius: moderateScale(14),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      padding: moderateScale(6),
      gap: moderateScale(4),
    },
    glassContainer: {
      borderWidth: 0,
    },
    imageContainer: {
      aspectRatio: 1,
      borderRadius: moderateScale(8),
      overflow: 'hidden',
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    image: {
      width: '100%',
      height: '100%',
    },
    reciterName: {
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      letterSpacing: latinLetterSpacing(-0.3),
    },
    // Bottom zone: surah + playback controls
    playbackZone: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(8),
      paddingHorizontal: moderateScale(6),
      paddingVertical: moderateScale(5),
      gap: moderateScale(4),
    },
    playbackZonePressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
    },
    playbackRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    surahName: {
      fontSize: moderateScale(9.5),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.7).toString(),
      letterSpacing: latinLetterSpacing(-0.2),
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
    },
    playButtonContainer: {
      width: moderateScale(12),
      height: moderateScale(12),
      justifyContent: 'center',
      alignItems: 'center',
    },
    sliderContainer: {
      height: moderateScale(4),
      flex: 1,
    },
    timeRemaining: {
      fontSize: moderateScale(7.5),
      fontFamily: 'Manrope-Bold',
      color: Color(theme.colors.text).alpha(0.5).toString(),
      minWidth: moderateScale(12),
      textAlign: 'right',
    },
  });
}
