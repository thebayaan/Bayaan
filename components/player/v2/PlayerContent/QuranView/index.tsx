import React, {useCallback, useRef, useEffect, useState} from 'react';
import {View, StyleSheet, Pressable, useWindowDimensions} from 'react-native';
import {moderateScale, verticalScale} from '@/utils/scale';
import {useResponsive} from '@/hooks/useResponsive';
import {Ionicons} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {useReadingThemeColors} from '@/hooks/useReadingThemeColors';
import {Surah} from '@/types/quran';
import {VerseItem} from './VerseItem';
import BasmalaHeader from './BasmalaHeader';
import SurahDivider, {computeDividerTotalHeight} from './SurahDivider';
import {FlashList, type FlashListRef} from '@shopify/flash-list';
import {useBottomSheetScrollableCreator} from '@gorhom/bottom-sheet';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import type {MushafArabicTextWeight} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import {useTimestampStore} from '@/store/timestampStore';
import {
  enhancedVersesBySurah,
  rebuildEnhancedVerses,
  type EnhancedVerse,
} from '@/utils/enhancedVerseData';
import {getTranslationName} from '@/utils/translationLookup';
import {useCurrentTrackRewayah} from '@/hooks/useCurrentTrackRewayah';

const surahData = require('@/data/surahData.json') as Surah[];

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
  indexedTajweedData: IndexedTajweedData | null;
  arabicTextWeight: MushafArabicTextWeight;
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
    indexedTajweedData,
    arabicTextWeight,
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
        indexedTajweedData={indexedTajweedData}
        arabicTextWeight={arabicTextWeight}
      />
    </>
  ),
);
QuranListHeader.displayName = 'QuranListHeader';

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
  /** When the player is in a tablet split layout, width of the left pane (defaults to window). */
  parentContentWidth?: number;
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
  parentContentWidth,
}) => {
  const {theme} = useTheme();
  const readingColors = useReadingThemeColors();
  const {width: screenWidth} = useWindowDimensions();
  const {isTablet} = useResponsive();
  const horizontalPad = moderateScale(20);
  const maxReadingColumn = isTablet ? 680 : Number.POSITIVE_INFINITY;
  const baseWidth = parentContentWidth ?? screenWidth;
  const contentWidth = Math.min(
    baseWidth - 2 * horizontalPad,
    maxReadingColumn,
  );
  const listRef = useRef<FlashListRef<EnhancedVerse>>(null);
  const renderScrollComponent = useBottomSheetScrollableCreator();
  const trackRewayah = useCurrentTrackRewayah();
  const surah = surahData.find(s => s.id === currentSurah);

  // Ayah timestamp tracking
  const currentVerseKey = useTimestampStore(s => s.currentAyah?.verseKey);
  const isLocked = useTimestampStore(s => s.isLocked);
  const setIsLocked = useTimestampStore(s => s.setIsLocked);

  // Granular mushaf settings selectors (avoid full-store subscription)
  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
  const selectedTranslationId = useMushafSettingsStore(
    s => s.selectedTranslationId,
  );
  const showWBW = useMushafSettingsStore(s => s.showWBW);
  const wbwShowTranslation = useMushafSettingsStore(s => s.wbwShowTranslation);
  const wbwShowTransliteration = useMushafSettingsStore(
    s => s.wbwShowTransliteration,
  );
  const translationName = getTranslationName(selectedTranslationId);

  // Counter to force re-render when enhanced verses are rebuilt (async)
  const [, setRebuildCounter] = useState(0);

  // DK Skia rendering: derive font family and fontMgr from mushafRenderer
  const isDK =
    (mushafRenderer === 'dk_v1' ||
      mushafRenderer === 'dk_v2' ||
      mushafRenderer === 'dk_indopak') &&
    mushafPreloadService.initialized &&
    digitalKhattDataService.initialized;
  const dkFontFamily =
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : mushafRenderer === 'dk_v1'
        ? 'DigitalKhattV1'
        : 'DigitalKhattV2';
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

  // Rebuild enhanced verse data when translation changes
  useEffect(() => {
    rebuildEnhancedVerses(selectedTranslationId).then(rebuilt => {
      if (rebuilt) setRebuildCounter(c => c + 1);
    });
  }, [selectedTranslationId]);

  // Direct lookup from module-scope pre-built arrays — zero computation per surah change
  const verses = enhancedVersesBySurah[currentSurah] ?? [];

  // Reset scroll position when currentSurah changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToOffset({offset: 0, animated: false});
    }
    setIsLocked(true);
  }, [currentSurah, setIsLocked]);

  // Auto-scroll to active ayah (only when locked)
  useEffect(() => {
    if (!currentVerseKey || !isLocked || !listRef.current) return;

    const index = verses.findIndex(v => v.verse_key === currentVerseKey);
    if (index === -1) return;

    try {
      listRef.current.scrollToIndex({index, animated: true, viewPosition: 0.3});
    } catch {
      // Index may be out of range during recycling — ignore
    }
  }, [currentVerseKey, verses, isLocked]);

  // Render verse items — annotations handled inside VerseItem via per-key selectors
  const renderItem = useCallback(
    ({item}: {item: EnhancedVerse}) => (
      <VerseItem
        verse={item}
        onVersePress={onVersePress}
        textColor={readingColors.text}
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
        isActive={isLocked && item.verse_key === currentVerseKey}
        translationName={translationName}
        translationId={selectedTranslationId}
        showWBW={showWBW}
        wbwShowTranslation={wbwShowTranslation}
        wbwShowTransliteration={wbwShowTransliteration}
        rewayah={trackRewayah}
      />
    ),
    [
      onVersePress,
      readingColors.text,
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
      isLocked,
      translationName,
      selectedTranslationId,
      showWBW,
      wbwShowTranslation,
      wbwShowTransliteration,
      arabicTextWeight,
      trackRewayah,
    ],
  );

  // Key extractor for items
  const keyExtractor = useCallback((item: EnhancedVerse) => item.verse_key, []);

  const effectivePaddingTop = Math.max(
    0,
    (contentPaddingTop || 0) - computeDividerTotalHeight(contentWidth),
  );

  const effectivePaddingBottom =
    (contentPaddingBottom || 0) + verticalScale(60);

  if (!surah || !verses.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FlashList
        ref={listRef}
        style={{width: contentWidth, height: '100%'}}
        data={verses}
        renderItem={renderItem}
        extraData={`${showWBW}-${wbwShowTranslation}-${wbwShowTransliteration}-${showTajweed}-${arabicFontSize}-${arabicTextWeight}-${showTranslation}-${showTransliteration}`}
        keyExtractor={keyExtractor}
        ListHeaderComponent={
          <QuranListHeader
            surahNumber={currentSurah}
            showBismillah={!!surah?.bismillah_pre}
            width={contentWidth}
            textColor={readingColors.textSecondary}
            nameColor={readingColors.text}
            showTajweed={showTajweed}
            fontMgr={fontMgr}
            dkFontFamily={dkFontFamily}
            indexedTajweedData={indexedTajweedData}
            arabicTextWeight={arabicTextWeight}
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
            setIsLocked(false);
          }
        }}
      />
      {!isLocked && currentVerseKey && (
        <Pressable
          style={[styles.recenterButton, {backgroundColor: theme.colors.card}]}
          onPress={() => {
            setIsLocked(true);
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
    alignItems: 'center',
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
