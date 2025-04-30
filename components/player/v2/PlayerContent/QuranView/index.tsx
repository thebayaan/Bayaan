import React, {useCallback, useRef, useEffect, useState} from 'react';
import {View, Text, Platform, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {MAX_PLAYER_CONTENT_HEIGHT} from '@/utils/constants';
import {Surah, QuranData, Verse} from '@/types/quran';
import {VerseItem} from './VerseItem';
import {useTajweedStore} from '@/store/tajweedStore';
import {
  LegendList,
  LegendListRef,
  LegendListRenderItemProps,
} from '@legendapp/list';

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
const transliterationDataCache =
  require('@/data/transliteration.json') as TransliterationData;

// Define transliteration data type
interface TransliterationVerse {
  t: string; // Transliteration text
}

interface TransliterationData {
  [verseKey: string]: TransliterationVerse;
}

// Enhanced verse type including translations and transliterations
interface EnhancedVerse extends Verse {
  translation?: string;
  transliteration?: string;
}

// Type for processed tajweed data
interface ProcessedTajweedWord {
  word_index: number;
  location: string;
  segments: {
    text: string;
    rule: string | null;
  }[];
}

// Verse type including tajweed data
type VerseWithTajweed = EnhancedVerse & {
  processedTajweedAyahData?: ProcessedTajweedWord[];
};

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
  const surah = surahData.find(s => s.id === currentSurah);
  const [transliterationMap] = useState(transliterationDataCache || {});
  const [isTransliterationLoaded] = useState(!!transliterationDataCache);

  // Use the tajweed store with indexed data for O(1) lookups
  const {indexedTajweedData} = useTajweedStore();

  // Memoize the getVersesForSurah function to avoid useMemo dependency issues
  const getVersesForSurahMemo = useCallback(() => {
    if (!quranData) {
      console.error('Quran data is not properly loaded');
      return [];
    }

    try {
      const verses = Object.values(quranData)
        .filter(verse => verse.surah_number === currentSurah)
        .sort((a, b) => a.ayah_number - b.ayah_number);

      // Map verses and attach translation/transliteration if loaded
      return verses.map(verse => {
        const verseKey = `${verse.surah_number}:${verse.ayah_number}`;
        // Always use Saheeh translation (with footnote tags)
        let translationText = '';
        if (saheehDataCache && saheehDataCache[verseKey]?.t) {
          translationText = saheehDataCache[verseKey].t;
        }
        let transliterationText = '';

        // Add transliteration if data is loaded
        if (isTransliterationLoaded && transliterationMap[verseKey]) {
          transliterationText = transliterationMap[verseKey].t;
        }

        // --- Attach pre-processed tajweed data directly ---
        const processedTajweedAyahData = indexedTajweedData
          ? indexedTajweedData[verseKey]
          : undefined;

        return {
          ...verse,
          translation: translationText,
          transliteration: transliterationText,
          processedTajweedAyahData,
        };
      });
    } catch (error) {
      console.error('Error processing verses:', error);
      return [];
    }
  }, [
    currentSurah,
    transliterationMap,
    isTransliterationLoaded,
    indexedTajweedData,
  ]);

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
    ({item}: LegendListRenderItemProps<VerseWithTajweed>) => {
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
          processedTajweedAyahData={item.processedTajweedAyahData}
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
  const keyExtractor = useCallback(
    (item: VerseWithTajweed) => item.verse_key,
    [],
  );

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
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
        nestedScrollEnabled={Platform.OS === 'android'}
        disableScrollViewPanResponder={Platform.OS === 'android'}
        recycleItems={true} // Enable item recycling for better performance
        estimatedItemSize={150} // Estimate average item height for better initial rendering
      />
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
