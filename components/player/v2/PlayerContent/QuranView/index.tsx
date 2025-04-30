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

// Pre-load translation and transliteration data outside component
let translationDataCache: VerseTranslation[] | null = null;
let transliterationDataCache: TransliterationData | null = null;

// Try to load these immediately
try {
  translationDataCache = require('@/data/quran-translation.json');
  transliterationDataCache = require('@/data/transliteration.json');
  console.log('[QuranView] Translation and transliteration data pre-cached');
} catch (error) {
  console.error('[QuranView] Error pre-caching data:', error);
}

// Define translation data type
interface TranslationItem {
  id: number;
  resource_id: number;
  text: string;
}

interface VerseTranslation {
  id: number;
  verse_number: number;
  verse_key: string;
  translations: TranslationItem[];
}

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
  const [translationData, setTranslationData] = useState(
    translationDataCache || [],
  );
  const [transliterationMap, setTransliterationMap] = useState(
    transliterationDataCache || {},
  );
  const [isTranslationLoaded, setIsTranslationLoaded] =
    useState(!!translationDataCache);
  const [isTransliterationLoaded, setIsTransliterationLoaded] = useState(
    !!transliterationDataCache,
  );

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
        let translationText = '';
        let transliterationText = '';

        // Add translation if data is loaded
        if (isTranslationLoaded) {
          const translation = translationData.find(
            t => t.verse_key === verseKey,
          );
          if (
            translation &&
            translation.translations &&
            translation.translations.length > 0
          ) {
            translationText = translation.translations[0].text;
          }
        }

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
    translationData,
    transliterationMap,
    isTranslationLoaded,
    isTransliterationLoaded,
    indexedTajweedData,
  ]);

  // Get verses data
  const verses = getVersesForSurahMemo();

  // Load translations if not pre-cached
  useEffect(() => {
    if (!isTranslationLoaded && !translationDataCache) {
      try {
        console.log('[QuranView] Loading translation data...');
        const translations =
          require('@/data/quran-translation.json') as VerseTranslation[];
        if (translations && translations.length > 0) {
          setTranslationData(translations);
          translationDataCache = translations; // Cache for future use
          setIsTranslationLoaded(true);
          console.log('[QuranView] Translation data loaded successfully.');
        } else {
          console.error('[QuranView] Translation data format is unexpected');
        }
      } catch (error) {
        console.error('[QuranView] Error loading translation data:', error);
      }
    }
  }, [isTranslationLoaded]);

  // Load transliterations if not pre-cached
  useEffect(() => {
    if (!isTransliterationLoaded && !transliterationDataCache) {
      try {
        console.log('[QuranView] Loading transliteration data...');
        const transliterations =
          require('@/data/transliteration.json') as TransliterationData;
        if (transliterations) {
          setTransliterationMap(transliterations);
          transliterationDataCache = transliterations; // Cache for future use
          setIsTransliterationLoaded(true);
          console.log('[QuranView] Transliteration data loaded successfully.');
        } else {
          console.error(
            '[QuranView] Transliteration data format is unexpected',
          );
        }
      } catch (error) {
        console.error('[QuranView] Error loading transliteration data:', error);
      }
    }
  }, [isTransliterationLoaded]);

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
