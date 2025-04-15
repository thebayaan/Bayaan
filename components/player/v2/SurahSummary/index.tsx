import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import * as Linking from 'expo-linking';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import BottomSheet from '@gorhom/bottom-sheet';
import ReadMore from '@fawazahmed/react-native-read-more';

type SurahInfo = {
  [key: string]: {
    surah_number: number;
    surah_name: string;
    text: string;
    short_text: string;
  };
};

interface SurahSummaryProps {
  surahInfo: SurahInfo;
  summaryBottomSheetRef: React.RefObject<BottomSheet>;
}

export const SurahSummary: React.FC<SurahSummaryProps> = ({
  surahInfo,
  summaryBottomSheetRef,
}) => {
  const {theme} = useTheme();
  const {queue} = useUnifiedPlayer();

  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const surahNumber = currentTrack?.surahId
    ? parseInt(currentTrack.surahId, 10)
    : undefined;
  const currentSurahInfo = surahNumber ? surahInfo[surahNumber] : undefined;

  const handleReadMore = () => {
    summaryBottomSheetRef.current?.expand();
  };

  const handleLinkPress = async () => {
    if (!surahNumber) return;
    const url = `https://quran.com/surah/${surahNumber}/info`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.log(`Don't know how to open this URL: ${url}`);
      }
    } catch (error) {
      console.error('An error occurred', error);
    }
  };

  if (!currentSurahInfo) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          shadowColor: theme.colors.shadow,
        },
      ]}>
      <TouchableOpacity activeOpacity={0.99} onPress={handleReadMore}>
        <Text style={[styles.title, {color: theme.colors.text}]}>
          About {currentSurahInfo.surah_name}
        </Text>
        <ReadMore
          numberOfLines={3}
          style={[styles.summary, {color: theme.colors.text}]}
          seeMoreText="read more"
          seeLessText="read full"
          seeMoreStyle={[styles.readMoreText, {color: theme.colors.text}]}
          seeLessStyle={[styles.readMoreText, {color: theme.colors.text}]}
          onSeeLess={handleReadMore}>
          {currentSurahInfo.short_text}
        </ReadMore>
      </TouchableOpacity>

      {surahNumber && (
        <Text style={[styles.sourceText, {color: theme.colors.textSecondary}]}>
          Retrieved from{' '}
          <Text style={styles.linkText} onPress={handleLinkPress}>
            Quran.com
          </Text>
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: moderateScale(16),
    borderRadius: moderateScale(20),
    marginTop: moderateScale(16),
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: moderateScale(18),
    fontFamily: 'Manrope-Bold',
    marginBottom: moderateScale(8),
  },
  summary: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Regular',
    lineHeight: moderateScale(20),
    opacity: 0.8,
    marginBottom: moderateScale(8),
  },
  readMoreText: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Bold',
    marginTop: moderateScale(4),
  },
  sourceText: {
    fontSize: moderateScale(10),
    fontFamily: 'Manrope-Regular',
    marginTop: moderateScale(8),
    textAlign: 'left',
  },
  linkText: {
    fontFamily: 'Manrope-SemiBold',
    textDecorationLine: 'underline',
  },
});
