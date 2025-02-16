import React, {useCallback} from 'react';
import {View, ScrollView, StyleSheet, Text} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {MAX_PLAYER_CONTENT_HEIGHT} from '@/utils/constants';
import {Surah, QuranData} from '@/types/quran';
import {VerseItem} from './VerseItem';

// Import data with type safety
const quranData = require('@/data/quran.json') as QuranData;
const surahData = require('@/data/surahData.json') as Surah[];

interface QuranViewProps {
  currentSurah: number;
  onVersePress: (verseKey: string) => void;
}

export const QuranView: React.FC<QuranViewProps> = ({
  currentSurah,
  onVersePress,
}) => {
  const {theme} = useTheme();
  const surah = surahData.find(s => s.id === currentSurah);

  // Safely get verses for the current surah
  const getVersesForSurah = useCallback(() => {
    if (!quranData) {
      console.error('Quran data is not properly loaded');
      return [];
    }

    try {
      return Object.values(quranData)
        .filter(verse => verse.surah_number === currentSurah)
        .sort((a, b) => a.ayah_number - b.ayah_number);
    } catch (error) {
      console.error('Error processing verses:', error);
      return [];
    }
  }, [currentSurah]);

  const verses = getVersesForSurah();

  if (!surah || !verses.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never">
        {/* Bismillah Header */}
        {surah.id !== 9 && (
          <View style={styles.bismillahContainer}>
            <Text style={[styles.bismillah, {color: theme.colors.text}]}>
              ﷽
            </Text>
          </View>
        )}

        {/* Verses */}
        {verses.map(verse => (
          <VerseItem
            key={verse.verse_key}
            verse={verse}
            onPress={() => onVersePress(verse.verse_key)}
            textColor={theme.colors.text}
            borderColor={theme.colors.border}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: MAX_PLAYER_CONTENT_HEIGHT,
    maxHeight: MAX_PLAYER_CONTENT_HEIGHT,
    marginTop: moderateScale(5),
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
    borderRadius: moderateScale(15),
  },
  scrollContent: {
    paddingBottom: verticalScale(20),
  },
  bismillahContainer: {
    width: '100%',
    paddingVertical: verticalScale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  bismillah: {
    fontSize: moderateScale(30),
    fontFamily: 'Uthmani',
    textAlign: 'center',
  },
});
