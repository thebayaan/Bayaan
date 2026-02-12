import React, {useCallback, useMemo, useRef, useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Surah, QuranData, Verse} from '@/types/quran';
import {VerseItem} from './VerseItem';
import {FlashList, type FlashListRef} from '@shopify/flash-list';
import {useBottomSheetScrollableCreator} from '@gorhom/bottom-sheet';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';

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
export interface EnhancedVerse extends Verse {
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
  transliterationFontSize: number;
  translationFontSize: number;
  arabicFontSize: number;
  contentPaddingTop?: number;
  contentPaddingBottom?: number;
}

export const QuranView: React.FC<QuranViewProps> = ({
  currentSurah,
  onVersePress,
  showTranslation = false,
  showTransliteration = false,
  transliterationFontSize,
  translationFontSize,
  arabicFontSize,
  contentPaddingTop,
  contentPaddingBottom,
}) => {
  const {theme} = useTheme();
  const listRef = useRef<FlashListRef<EnhancedVerse>>(null);
  const renderScrollComponent = useBottomSheetScrollableCreator();
  const surah = surahData.find(s => s.id === currentSurah);

  // Granular mushaf settings selectors (avoid full-store subscription)
  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);

  // DK Skia rendering: derive font family and fontMgr from mushafRenderer
  const isDK =
    (mushafRenderer === 'dk_v1' || mushafRenderer === 'dk_v2') &&
    mushafPreloadService.initialized &&
    digitalKhattDataService.initialized;
  const dkFontFamily =
    mushafRenderer === 'dk_v1' ? 'DigitalKhattV1' : 'DigitalKhattV2';
  const fontMgr = isDK ? mushafPreloadService.fontMgr : null;

  // Tajweed data for DK Skia rendering (verse-level indexed)
  const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);

  // Only need the loader — VerseItem subscribes to its own annotation data
  const loadAnnotationsForSurah = useVerseAnnotationsStore(
    s => s.loadAnnotationsForSurah,
  );

  // Load annotations when surah changes
  useEffect(() => {
    loadAnnotationsForSurah(currentSurah);
  }, [currentSurah, loadAnnotationsForSurah]);

  // Memoize verses array — only recomputed when surah changes
  const verses = useMemo(() => {
    const surahVerses = versesBySurah[currentSurah];
    if (!surahVerses) return [];

    return surahVerses.map(verse => {
      const verseKey = `${verse.surah_number}:${verse.ayah_number}`;
      return {
        ...verse,
        translation: saheehDataCache?.[verseKey]?.t || '',
        transliteration: transliterationDataCache?.[verseKey]?.t || '',
      };
    });
  }, [currentSurah]);

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

  // Render verse items — annotations handled inside VerseItem via per-key selectors
  const renderItem = useCallback(
    ({item}: {item: EnhancedVerse}) => (
      <VerseItem
        verse={item}
        onVersePress={onVersePress}
        textColor={theme.colors.text}
        borderColor={theme.colors.border}
        showTranslation={showTranslation}
        showTransliteration={showTransliteration}
        showTajweed={showTajweed}
        arabicFontFamily={'Uthmani'}
        transliterationFontSize={transliterationFontSize}
        translationFontSize={translationFontSize}
        arabicFontSize={arabicFontSize}
        fontMgr={fontMgr}
        dkFontFamily={dkFontFamily}
        indexedTajweedData={indexedTajweedData}
      />
    ),
    [
      onVersePress,
      theme.colors.text,
      theme.colors.border,
      showTranslation,
      showTransliteration,
      showTajweed,
      transliterationFontSize,
      translationFontSize,
      arabicFontSize,
      fontMgr,
      dkFontFamily,
      indexedTajweedData,
    ],
  );

  // Key extractor for items
  const keyExtractor = useCallback((item: EnhancedVerse) => item.verse_key, []);

  if (!surah || !verses.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FlashList
        ref={listRef}
        data={verses}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{
          paddingTop: contentPaddingTop,
          paddingBottom: (contentPaddingBottom || 0) + verticalScale(20),
        }}
        renderScrollComponent={renderScrollComponent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
        drawDistance={1500}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    borderRadius: moderateScale(15),
    overflow: 'hidden',
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
