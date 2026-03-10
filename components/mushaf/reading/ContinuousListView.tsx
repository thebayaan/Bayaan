import React, {
  useMemo,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {View} from 'react-native';
import {FlashList, type FlashListRef} from '@shopify/flash-list';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {
  enhancedVersesBySurah,
  type EnhancedVerse,
} from '@/utils/enhancedVerseData';
import {VerseItem} from '@/components/player/v2/PlayerContent/QuranView/VerseItem';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import SurahDivider from '@/components/player/v2/PlayerContent/QuranView/SurahDivider';
import BasmalaHeader from '@/components/player/v2/PlayerContent/QuranView/BasmalaHeader';
import {getTranslationName} from '@/utils/translationLookup';
import {SCREEN_WIDTH} from '../constants';

const surahData = require('@/data/surahData.json') as Array<{
  id: number;
  name: string;
  bismillah_pre: boolean;
  verses_count: number;
}>;

// Item types for the flat list
type ContinuousListItem =
  | {type: 'surah_header'; surahNumber: number; showBismillah: boolean}
  | {type: 'verse'; verse: EnhancedVerse; surahNumber: number};

// Build the flat list once at module scope
let cachedItems: ContinuousListItem[] | null = null;

function buildContinuousListItems(): ContinuousListItem[] {
  if (cachedItems) return cachedItems;

  const items: ContinuousListItem[] = [];
  for (const surah of surahData) {
    items.push({
      type: 'surah_header',
      surahNumber: surah.id,
      showBismillah: surah.bismillah_pre,
    });

    const verses = enhancedVersesBySurah[surah.id];
    if (verses) {
      for (const verse of verses) {
        items.push({type: 'verse', verse, surahNumber: surah.id});
      }
    }
  }

  cachedItems = items;
  return items;
}

// Precomputed lookup: surahNumber → index in flat list
let surahIndexMap: Map<number, number> | null = null;
// Precomputed lookup: verseKey → index in flat list
let verseIndexMap: Map<string, number> | null = null;

function getSurahIndex(surahNumber: number): number {
  if (!surahIndexMap) {
    surahIndexMap = new Map();
    const items = buildContinuousListItems();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (
        item.type === 'surah_header' &&
        !surahIndexMap.has(item.surahNumber)
      ) {
        surahIndexMap.set(item.surahNumber, i);
      }
    }
  }
  return surahIndexMap.get(surahNumber) ?? 0;
}

function getVerseIndex(verseKey: string): number {
  if (!verseIndexMap) {
    verseIndexMap = new Map();
    const items = buildContinuousListItems();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type === 'verse') {
        verseIndexMap.set(item.verse.verse_key, i);
      }
    }
  }
  return verseIndexMap.get(verseKey) ?? 0;
}

// Reverse lookup: verseKey → page number (built lazily from all 604 pages)
let verseToPageMap: Map<string, number> | null = null;

function getPageForVerse(verseKey: string): number | null {
  if (!verseToPageMap) {
    if (!digitalKhattDataService.initialized) return null;
    verseToPageMap = new Map();
    for (let page = 1; page <= 604; page++) {
      const keys = mushafVerseMapService.getOrderedVerseKeysForPage(page);
      for (const key of keys) {
        // First occurrence wins — a verse spanning two pages maps to its start page
        if (!verseToPageMap.has(key)) {
          verseToPageMap.set(key, page);
        }
      }
    }
  }
  return verseToPageMap.get(verseKey) ?? null;
}

// Map page number → first verse key on that page for scroll-to-page support
function getFirstVerseKeyForPage(pageNumber: number): string | null {
  if (!digitalKhattDataService.initialized) return null;
  const verseKeys =
    mushafVerseMapService.getOrderedVerseKeysForPage(pageNumber);
  return verseKeys.length > 0 ? verseKeys[0] : null;
}

// Public handle for imperative navigation from MushafViewer
export interface ContinuousListViewHandle {
  scrollToPage: (page: number, animated?: boolean) => void;
  scrollToSurah: (surahId: number, animated?: boolean) => void;
  scrollToVerse: (verseKey: string, animated?: boolean) => void;
}

interface ContinuousListViewProps {
  textColor: string;
  labelColor: string;
  borderColor: string;
  onTap?: () => void;
  initialPage: number;
  onCurrentSurahChange?: (surahId: number) => void;
  onCurrentPageChange?: (page: number) => void;
}

const ContinuousListView = forwardRef<
  ContinuousListViewHandle,
  ContinuousListViewProps
>(
  (
    {
      textColor,
      labelColor,
      borderColor,
      onTap,
      initialPage,
      onCurrentSurahChange,
      onCurrentPageChange,
    },
    ref,
  ) => {
    const insets = useSafeAreaInsets();
    const flashListRef = useRef<FlashListRef<ContinuousListItem>>(null);

    // Active ayah highlighting (same pattern as player QuranView)
    const currentVerseKey = useMushafPlayerStore(s => s.currentVerseKey);
    const playbackState = useMushafPlayerStore(s => s.playbackState);
    const isPlaying = playbackState === 'playing';


    // Expose navigation methods to parent
    useImperativeHandle(ref, () => ({
      scrollToPage: (page: number, animated = false) => {
        const verseKey = getFirstVerseKeyForPage(page);
        if (verseKey) {
          const index = getVerseIndex(verseKey);
          flashListRef.current?.scrollToIndex({index, animated});
        }
      },
      scrollToSurah: (surahId: number, animated = false) => {
        const index = getSurahIndex(surahId);
        flashListRef.current?.scrollToIndex({index, animated});
      },
      scrollToVerse: (verseKey: string, animated = false) => {
        const index = getVerseIndex(verseKey);
        flashListRef.current?.scrollToIndex({index, animated});
      },
    }));

    // Settings subscriptions
    const showTranslation = useMushafSettingsStore(s => s.showTranslation);
    const showTransliteration = useMushafSettingsStore(
      s => s.showTransliteration,
    );
    const showTajweed = useMushafSettingsStore(s => s.showTajweed);
    const showWBW = useMushafSettingsStore(s => s.showWBW);
    const wbwShowTranslation = useMushafSettingsStore(
      s => s.wbwShowTranslation,
    );
    const wbwShowTransliteration = useMushafSettingsStore(
      s => s.wbwShowTransliteration,
    );
    const arabicFontSize = useMushafSettingsStore(s => s.arabicFontSize);
    const translationFontSize = useMushafSettingsStore(
      s => s.translationFontSize,
    );
    const transliterationFontSize = useMushafSettingsStore(
      s => s.transliterationFontSize,
    );
    const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
    const selectedTranslationId = useMushafSettingsStore(
      s => s.selectedTranslationId,
    );
    const translationName = getTranslationName(selectedTranslationId);

    const dkFontFamily =
      mushafRenderer === 'dk_indopak'
        ? 'DigitalKhattIndoPak'
        : mushafRenderer === 'dk_v1'
        ? 'DigitalKhattV1'
        : 'DigitalKhattV2';
    const isDK =
      (mushafRenderer === 'dk_v1' ||
        mushafRenderer === 'dk_v2' ||
        mushafRenderer === 'dk_indopak') &&
      mushafPreloadService.initialized &&
      digitalKhattDataService.initialized;
    const fontMgr = isDK ? mushafPreloadService.fontMgr : null;
    const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);

    const items = useMemo(() => buildContinuousListItems(), []);

    const contentWidth = SCREEN_WIDTH - moderateScale(24);

    // Load annotations for visible surahs
    const loadAnnotationsForSurah = useVerseAnnotationsStore(
      s => s.loadAnnotationsForSurah,
    );

    const handleVersePress = useCallback(() => {
      onTap?.();
    }, [onTap]);

    // Compute initial scroll index from page number
    const initialScrollIndex = useMemo(() => {
      const verseKey = getFirstVerseKeyForPage(initialPage);
      if (verseKey) return getVerseIndex(verseKey);
      return 0;
    }, [initialPage]);

    // Track viewable items for surah/page updates
    const onViewableItemsChanged = useCallback(
      ({viewableItems}: {viewableItems: Array<{item: ContinuousListItem}>}) => {
        if (viewableItems.length === 0) return;
        const firstItem = viewableItems[0].item;
        if (firstItem.type === 'surah_header') {
          onCurrentSurahChange?.(firstItem.surahNumber);
          loadAnnotationsForSurah(firstItem.surahNumber);
        } else if (firstItem.type === 'verse') {
          onCurrentSurahChange?.(firstItem.surahNumber);
          loadAnnotationsForSurah(firstItem.surahNumber);
          // Report accurate page number from verse-to-page mapping
          const page = getPageForVerse(firstItem.verse.verse_key);
          if (page) onCurrentPageChange?.(page);
        }
      },
      [onCurrentSurahChange, onCurrentPageChange, loadAnnotationsForSurah],
    );

    const renderItem = useCallback(
      ({item}: {item: ContinuousListItem}) => {
        if (item.type === 'surah_header') {
          return (
            <View>
              <SurahDivider
                width={contentWidth}
                surahNumber={item.surahNumber}
                textColor={labelColor}
                nameColor={textColor}
              />
              <BasmalaHeader
                visible={item.showBismillah}
                width={contentWidth}
                textColor={textColor}
                showTajweed={showTajweed}
                fontMgr={fontMgr}
                dkFontFamily={dkFontFamily}
                indexedTajweedData={indexedTajweedData}
              />
            </View>
          );
        }

        return (
          <VerseItem
            verse={item.verse}
            onVersePress={handleVersePress}
            textColor={textColor}
            borderColor={borderColor}
            showTranslation={showTranslation}
            showTransliteration={showTransliteration}
            showTajweed={showTajweed}
            arabicFontFamily="Uthmani"
            transliterationFontSize={transliterationFontSize}
            translationFontSize={translationFontSize}
            arabicFontSize={arabicFontSize}
            fontMgr={fontMgr}
            dkFontFamily={dkFontFamily}
            indexedTajweedData={indexedTajweedData}
            isActive={isPlaying && item.verse.verse_key === currentVerseKey}
            source="mushaf"
            translationName={translationName}
            translationId={selectedTranslationId}
            showWBW={showWBW}
            wbwShowTranslation={wbwShowTranslation}
            wbwShowTransliteration={wbwShowTransliteration}
          />
        );
      },
      [
        contentWidth,
        textColor,
        labelColor,
        borderColor,
        showTranslation,
        showTransliteration,
        showTajweed,
        arabicFontSize,
        translationFontSize,
        transliterationFontSize,
        fontMgr,
        dkFontFamily,
        indexedTajweedData,
        handleVersePress,
        currentVerseKey,
        isPlaying,
        translationName,
        selectedTranslationId,
        showWBW,
        wbwShowTranslation,
        wbwShowTransliteration,
      ],
    );

    const getItemType = useCallback(
      (item: ContinuousListItem) => item.type,
      [],
    );

    const keyExtractor = useCallback(
      (item: ContinuousListItem, _index: number) => {
        if (item.type === 'surah_header') return `header-${item.surahNumber}`;
        return item.verse.verse_key;
      },
      [],
    );

    return (
      <FlashList
        ref={flashListRef}
        data={items}
        renderItem={renderItem}
        extraData={currentVerseKey}
        getItemType={getItemType}
        keyExtractor={keyExtractor}
        initialScrollIndex={initialScrollIndex}
        contentContainerStyle={{
          paddingTop: insets.top + verticalScale(60),
          paddingBottom: insets.bottom + verticalScale(80),
          paddingHorizontal: moderateScale(12),
        }}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{itemVisiblePercentThreshold: 50}}
      />
    );
  },
);

export default React.memo(ContinuousListView);

// Re-export navigation helpers for use by MushafViewer
export {getSurahIndex, getVerseIndex, getFirstVerseKeyForPage};
