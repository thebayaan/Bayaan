import React from 'react';
import {View, StyleSheet, Text, TouchableOpacity} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import ReadMore from '@fawazahmed/react-native-read-more';
import {useRouter} from 'expo-router';

interface SurahSummaryProps {
  surahNumber: number | undefined;
  surahInfo: {
    [key: string]: {
      surah_number: number;
      surah_name: string;
      text: string;
      short_text: string;
    };
  };
}

const SurahSummary: React.FC<SurahSummaryProps> = ({
  surahNumber,
  surahInfo,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();

  const surahData =
    surahNumber && surahNumber.toString() in surahInfo
      ? surahInfo[surahNumber.toString()]
      : null;

  const summaryText = surahData
    ? surahData.short_text
    : 'No summary available.';

  const handleReadFull = () => {
    if (surahData) {
      router.push({
        pathname: '/player/extended-summary',
        params: {
          surahNumber: surahData.surah_number,
          surahName: surahData.surah_name,
          fullText: surahData.text,
        },
      });
    }
  };

  return (
    <View style={styles.summaryCard}>
      <TouchableOpacity activeOpacity={0.99} onPress={handleReadFull}>
        <Text style={styles.summaryTitle}>About the surah</Text>
        <ReadMore
          numberOfLines={3}
          style={styles.summaryText}
          seeMoreText="read more"
          seeLessText="read full"
          seeMoreStyle={styles.readMoreText}
          seeLessStyle={styles.readMoreText}
          onSeeLess={handleReadFull}>
          {summaryText}
        </ReadMore>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    summaryCard: {
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(12),
      padding: moderateScale(16),
      width: '100%',
      shadowColor: theme.colors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    summaryTitle: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      marginBottom: moderateScale(8),
      color: theme.colors.text,
    },
    summaryText: {
      fontSize: moderateScale(12),
      color: theme.colors.text,
      lineHeight: moderateScale(20),
    },
    readMoreText: {
      color: theme.colors.text,
      fontWeight: 'bold',
      marginTop: moderateScale(4),
    },
  });

export default SurahSummary;
