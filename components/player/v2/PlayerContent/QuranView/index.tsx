import React, {useCallback, useRef, useEffect, useState} from 'react';
import {View, StyleSheet, Pressable, useWindowDimensions} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {Ionicons} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {Surah, QuranData, Verse} from '@/types/quran';
import {VerseItem} from './VerseItem';
import BasmalaHeader from './BasmalaHeader';
import SurahDivider, {computeDividerTotalHeight} from './SurahDivider';
import {FlashList, type FlashListRef} from '@shopify/flash-list';
import {useBottomSheetScrollableCreator} from '@gorhom/bottom-sheet';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import {useTimestampStore} from '@/store/timestampStore';

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

// Pre-build enhanced verse arrays with translations at module scope — zero computation per surah change
const enhancedVersesBySurah: Record<number, EnhancedVerse[]> = {};
for (const [surahStr, surahVerses] of Object.entries(versesBySurah)) {
  enhancedVersesBySurah[Number(surahStr)] = surahVerses.map(verse => {
    const verseKey = `${verse.surah_number}:${verse.ayah_number}`;
    return {
      ...verse,
      translation: saheehDataCache?.[verseKey]?.t || '',
      transliteration: transliterationDataCache?.[verseKey]?.t || '',
    };
  });
}

// Module-scope header — stable component identity prevents FlashList unmount/remount
interface QuranListHeaderProps {
  surahNumber: number;
  showBismillah: boolean;
  width: number;
  textColor: string;
  nameColor: string;
  showTajweed: boolean;
  fontMgr: SkTypefaceFontProvider | null;
  dkFontFamily: string;
  arabicFontSize: number;
  indexedTajweedData: IndexedTajweedData | null;
}

const QuranListHeader = React.memo<QuranListHeaderProps>(
  ({
    surahNumber,
    showBismillah,
    width,
    textColor,
    nameColor,
    showTajweed,
    fontMgr,
    dkFontFamily,
    arabicFontSize,
    indexedTajweedData,
  }) => (
    <>
      <SurahDivider
        width={width}
        surahNumber={surahNumber}
        textColor={textColor}
        nameColor={nameColor}
      />
      <BasmalaHeader
        visible={showBismillah}
        width={width}
        textColor={nameColor}
        showTajweed={showTajweed}
        fontMgr={fontMgr}
        dkFontFamily={dkFontFamily}
        arabicFontSize={arabicFontSize}
        indexedTajweedData={indexedTajweedData}
      />
    </>
  ),
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
  const {width: screenWidth} = useWindowDimensions();
  const contentWidth = screenWidth - 2 * moderateScale(20);
  const listRef = useRef<FlashListRef<EnhancedVerse>>(null);
  const renderScrollComponent = useBottomSheetScrollableCreator();
  const surah = surahData.find(s => s.id === currentSurah);

  // Ayah timestamp tracking
  const currentVerseKey = useTimestampStore(s => s.currentAyah?.verseKey);
  const isFollowingRef = useRef(true);
  const [showRecenter, setShowRecenter] = useState(false);

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

  // Direct lookup from module-scope pre-built arrays — zero computation per surah change
  const verses = enhancedVersesBySurah[currentSurah] ?? [];

  // Reset scroll position when currentSurah changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToOffset({offset: 0, animated: false});
    }
    isFollowingRef.current = true;
    setShowRecenter(false);
  }, [currentSurah]);

  // Auto-scroll to active ayah
  useEffect(() => {
    if (!currentVerseKey || !isFollowingRef.current || !listRef.current) return;

    const index = verses.findIndex(v => v.verse_key === currentVerseKey);
    if (index === -1) return;

    try {
      listRef.current.scrollToIndex({index, animated: true, viewPosition: 0.3});
    } catch {
      // Index may be out of range during recycling — ignore
    }
  }, [currentVerseKey, verses]);


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
        isActive={item.verse_key === currentVerseKey}
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
      currentVerseKey,
    ],
  );

  // Key extractor for items
  const keyExtractor = useCallback((item: EnhancedVerse) => item.verse_key, []);

  const effectivePaddingTop = Math.max(
    0,
    (contentPaddingTop || 0) - computeDividerTotalHeight(contentWidth),
  );

  const effectivePaddingBottom =
    (contentPaddingBottom || 0) + verticalScale(20);

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
        ListHeaderComponent={
          <QuranListHeader
            surahNumber={currentSurah}
            showBismillah={!!surah?.bismillah_pre}
            width={contentWidth}
            textColor={theme.colors.textSecondary}
            nameColor={theme.colors.text}
            showTajweed={showTajweed}
            fontMgr={fontMgr}
            dkFontFamily={dkFontFamily}
            arabicFontSize={arabicFontSize}
            indexedTajweedData={indexedTajweedData}
          />
        }
        contentContainerStyle={{
          paddingTop: effectivePaddingTop,
          paddingBottom: effectivePaddingBottom,
        }}
        renderScrollComponent={renderScrollComponent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
        drawDistance={1500}
        onScrollBeginDrag={() => {
          if (currentVerseKey) {
            isFollowingRef.current = false;
            setShowRecenter(true);
          }
        }}
      />
      {showRecenter && currentVerseKey && (
        <Pressable
          style={[styles.recenterButton, {backgroundColor: theme.colors.card}]}
          onPress={() => {
            isFollowingRef.current = true;
            setShowRecenter(false);
            const index = verses.findIndex(
              v => v.verse_key === currentVerseKey,
            );
            if (index !== -1 && listRef.current) {
              listRef.current.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0.3,
              });
            }
          }}>
          <Ionicons name="locate-outline" size={20} color={theme.colors.text} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  recenterButton: {
    position: 'absolute',
    bottom: verticalScale(16),
    right: moderateScale(16),
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
