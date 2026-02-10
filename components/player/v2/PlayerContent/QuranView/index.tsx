import React, {useCallback, useRef, useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Surah, QuranData, Verse} from '@/types/quran';
import {VerseItem} from './VerseItem';
import {
  LegendList,
  LegendListRef,
  LegendListRenderItemProps,
} from '@legendapp/list';
import {useBottomSheetScrollableCreator} from '@gorhom/bottom-sheet';

// Import data with type safety - move outside component to load only once
const quranData = require('@/data/quran.json') as QuranData;
const surahData = require('@/data/surahData.json') as Surah[];

// Define Saheeh International translation data entry
interface SaheehEntry {
  t: string;
  f?: Record<string, string>;
}
// Load Saheeh translation and transliteration data
const saheehDataCache =
  require('@/data/SaheehInternational.translation-with-footnote-tags.json') as Record<
    string,
    SaheehEntry
  >;

// Define transliteration data type
interface TransliterationVerse {
  t: string; // Transliteration text
}

interface TransliterationData {
  [verseKey: string]: TransliterationVerse;
}

const transliterationDataCache =
  require('@/data/transliteration.json') as TransliterationData;

// Enhanced verse type including translations and transliterations
interface EnhancedVerse extends Verse {
  translation?: string;
  transliteration?: string;
}

// Pre-index verses by surah at module scope (one-time O(6236) cost, then O(1) per lookup)
const versesBySurah: Record<number, Verse[]> = {};
Object.values(quranData).forEach(verse => {
  (versesBySurah[verse.surah_number] ??= []).push(verse);
});
Object.values(versesBySurah).forEach(arr =>
  arr.sort((a, b) => a.ayah_number - b.ayah_number),
);

interface QuranViewProps {
  currentSurah: number;
  onVersePress: (verseKey: string) => void;
  showTranslation?: boolean;
  showTransliteration?: boolean;
  showTajweed?: boolean;
  transliterationFontSize: number;
  translationFontSize: number;
  arabicFontSize: number;
}

export const QuranView: React.FC<QuranViewProps> = ({
  currentSurah,
  onVersePress,
  showTranslation = false,
  showTransliteration = false,
  transliterationFontSize,
  translationFontSize,
  arabicFontSize,
}) => {
  const {theme} = useTheme();
  const listRef = useRef<LegendListRef>(null);
  const renderScrollComponent = useBottomSheetScrollableCreator();
  const surah = surahData.find(s => s.id === currentSurah);

  // Memoize the getVersesForSurah function — no tajweed dependency
  const getVersesForSurahMemo = useCallback(() => {
    const surahVerses = versesBySurah[currentSurah];
    if (!surahVerses) {
      return [];
    }

    try {
      return surahVerses.map(verse => {
        const verseKey = `${verse.surah_number}:${verse.ayah_number}`;
        let translationText = '';
        if (saheehDataCache?.[verseKey]?.t) {
          translationText = saheehDataCache[verseKey].t;
        }
        let transliterationText = '';
        if (transliterationDataCache?.[verseKey]) {
          transliterationText = transliterationDataCache[verseKey].t;
        }

        return {
          ...verse,
          translation: translationText,
          transliteration: transliterationText,
        };
      });
    } catch (error) {
      console.error('Error processing verses:', error);
      return [];
    }
  }, [currentSurah]);

  // Get verses data
  const verses = getVersesForSurahMemo();

  // Reset scroll position when currentSurah changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToOffset({offset: 0, animated: false});
    }
  }, [currentSurah]);

  // Render the bismillah header (to be used as list header)
  const renderHeader = useCallback(() => {
    if (!surah?.bismillah_pre) return null;
    return (
      <View style={styles.bismillahContainer}>
        <Text style={[styles.bismillah, {color: theme.colors.text}]}>﷽</Text>
      </View>
    );
  }, [surah?.bismillah_pre, theme.colors.text]);

  // Render the verse items (optimized with LegendList)
  const renderItem = useCallback(
    ({item}: LegendListRenderItemProps<EnhancedVerse>) => {
      return (
        <VerseItem
          verse={item}
          onPress={() => onVersePress(item.verse_key)}
          textColor={theme.colors.text}
          borderColor={theme.colors.border}
          showTranslation={showTranslation}
          showTransliteration={showTransliteration}
          transliterationFontSize={transliterationFontSize}
          translationFontSize={translationFontSize}
          arabicFontSize={arabicFontSize}
        />
      );
    },
    [
      onVersePress,
      theme.colors.text,
      theme.colors.border,
      showTranslation,
      showTransliteration,
      transliterationFontSize,
      translationFontSize,
      arabicFontSize,
    ],
  );

  // Key extractor for items
  const keyExtractor = useCallback((item: EnhancedVerse) => item.verse_key, []);

  if (!surah || !verses.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      <LegendList
        ref={listRef}
        data={verses}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        style={styles.list}
        contentContainerStyle={styles.scrollContent}
        renderScrollComponent={renderScrollComponent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
        recycleItems={true}
        estimatedItemSize={150}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  list: {
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
    fontFamily: 'QPC',
    textAlign: 'center',
  },
});
