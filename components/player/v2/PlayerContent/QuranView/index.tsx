import React, {useCallback, useRef, useEffect, useState, useMemo} from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import {moderateScale, verticalScale} from '@/utils/scale';
import {useResponsive} from '@/hooks/useResponsive';
import {Ionicons} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {useReadingThemeColors} from '@/hooks/useReadingThemeColors';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
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
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
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
import {usePlayerStore} from '@/services/player/store/playerStore';
import branding from '@/config/branding';

const surahData = require('@/data/surahData.json') as Surah[];

// RFC-014 — module-scope one-shot dev warning for forks that opt into the
// 'native' scroll behavior. Surfaces the "must provide an alternative
// dismiss affordance" responsibility at dev time (no type-level
// enforcement). Stripped from Release by the __DEV__ dead-code path at
// the call site.
let __warnedPlayerScrollBehaviorNative = false;
function warnOncePlayerScrollBehaviorNative() {
  if (__warnedPlayerScrollBehaviorNative) return;
  __warnedPlayerScrollBehaviorNative = true;
  console.warn(
    "[branding.playerMushafScrollBehavior] === 'native': the player " +
      "sheet's swipe-down-to-dismiss gesture is disabled at the Mushaf " +
      'list level. Ensure an alternative dismiss affordance (e.g. an ' +
      'explicit close button) is present in the player header. See ' +
      'docs/rfcs/014-player-scroll-strategy-seam.md.',
  );
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
  indexedTajweedData: IndexedTajweedData | null;
  arabicTextWeight: MushafArabicTextWeight;
  showAllahNameHighlight: boolean;
  allahNameHighlightColor: string;
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
    showAllahNameHighlight,
    allahNameHighlightColor,
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
        showAllahNameHighlight={showAllahNameHighlight}
        allahNameHighlightColor={allahNameHighlightColor}
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
  // RFC-014 — fork-supplied scroll-handler strategy. `'gorhom'` (default)
  // wires the bottom-sheet scrollable so the player sheet inherits the
  // FlashList scroll gesture as its swipe-down-to-dismiss. `'native'`
  // skips the wrapper — imperative scrollToIndex/scrollToOffset calls
  // (RFC-013's anchor, the active-ayah auto-scroll, the rAF-deferred
  // surah-change seek, and the scroll-to-top fallback) reach the native
  // scroll node immediately, but the sheet's swipe-to-dismiss gesture is
  // lost at the Mushaf list level — forks opting in must provide an
  // alternative dismiss affordance. The hook is called unconditionally to
  // satisfy rules-of-hooks; the factory is discarded when behavior is
  // 'native'. See docs/rfcs/014-player-scroll-strategy-seam.md.
  const scrollBehavior = branding.playerMushafScrollBehavior ?? 'gorhom';
  const gorhomScrollComponent = useBottomSheetScrollableCreator();
  const renderScrollComponent =
    scrollBehavior === 'gorhom' ? gorhomScrollComponent : undefined;
  if (__DEV__ && scrollBehavior === 'native') {
    warnOncePlayerScrollBehaviorNative();
  }
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
  const showAllahNameHighlight = useMushafSettingsStore(
    s => s.showAllahNameHighlight,
  );
  const allahNameHighlightColorSetting = useMushafSettingsStore(
    s => s.allahNameHighlightColor,
  );
  const selectedTranslationId = useMushafSettingsStore(
    s => s.selectedTranslationId,
  );
  const showWBW = useMushafSettingsStore(s => s.showWBW);
  const wbwShowTranslation = useMushafSettingsStore(s => s.wbwShowTranslation);
  const wbwShowTransliteration = useMushafSettingsStore(
    s => s.wbwShowTransliteration,
  );
  const translationName = getTranslationName(selectedTranslationId);
  const allahNameHighlightColor = useMemo(
    () =>
      getAllahNameHighlightColorHex(
        allahNameHighlightColorSetting,
        theme.isDarkMode,
      ),
    [allahNameHighlightColorSetting, theme.isDarkMode],
  );

  // Counter to force re-render when enhanced verses are rebuilt (async)
  const [, setRebuildCounter] = useState(0);

  // Measured ListHeaderComponent height (SurahDivider + BasmalaHeader). Used
  // as a negative `viewOffset` on imperative scrollToIndex calls so the
  // target verse lands fully below the header rather than partially behind
  // it. FlashList v2's `initialScrollIndex` + `scrollToIndex` compute their
  // target offset from item layouts only; without this compensation, the
  // 5% viewPosition lands inside the header band. Stored in a ref so a
  // measurement change doesn't itself trigger re-render of the surah-change
  // effect — the ref is read at scroll time, by which point onLayout has
  // run. Initialized to 0 (no compensation) → first paint may briefly
  // under-shoot; the 2-rAF deferred scrollToIndex below corrects it once
  // the header has measured.
  const headerHeightRef = useRef(0);
  const handleHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    headerHeightRef.current = e.nativeEvent.layout.height;
  }, []);

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
  const subscribedFontMgr = useMushafFontMgr();
  const fontMgr = isDK ? subscribedFontMgr : null;

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

  // Direct lookup from module-scope pre-built arrays — zero computation per surah change.
  // useMemo gives a stable reference so dep arrays of hooks reading `verses` don't
  // change on every render (was a pre-existing react-hooks/exhaustive-deps warning).
  const verses = useMemo(
    () => enhancedVersesBySurah[currentSurah] ?? [],
    [currentSurah],
  );

  // RFC-013 — fork-supplied initial anchor. Granular selectors so QuranView
  // doesn't re-render on every player tick. The hook is consulted on
  // currentSurah change; `undefined` (no hook OR hook returns undefined OR
  // returned verse_key not found in `verses`) keeps today's
  // scroll-to-top-of-surah behavior.
  const currentTrack = usePlayerStore(
    s => s.queue.tracks[s.queue.currentIndex],
  );
  const initialScrollIndex = useMemo(() => {
    if (!currentTrack || !branding.initialPlayerVerseKey) return undefined;
    const verseKey = branding.initialPlayerVerseKey(currentTrack);
    if (!verseKey) return undefined;
    const idx = verses.findIndex(v => v.verse_key === verseKey);
    return idx >= 0 ? idx : undefined;
  }, [currentTrack, verses]);

  // Reset scroll position when currentSurah changes. When the fork's
  // `initialPlayerVerseKey` resolves to an index, defer scrollToIndex two
  // animation frames so FlashList has time to re-layout for the new `data`
  // — calling scrollToIndex synchronously in the same render cycle as the
  // data change silently no-ops on FlashList v2 (no
  // `onScrollToIndexFailed` escape hatch like FlatList). For the first
  // mount, `initialScrollIndex` on FlashList handles it natively, so this
  // effect's branch is mainly for subsequent in-app surah switches where
  // the list stays mounted.
  //
  // `viewOffset: -headerHeight` compensates for ListHeaderComponent
  // (SurahDivider + BasmalaHeader). Without this, FlashList v2 computes
  // the target scroll offset from item layouts only and the verse lands
  // partially behind the header. `viewPosition: 0.05` then places the
  // verse 5% down from the post-header viewport top.
  //
  // Multi-surah double-fire note: in single-surah Bayaan tracks, a track
  // change always changes currentSurah, so this effect fires exactly once.
  // If multi-surah tracks ship later (e.g. Juz-spanning recitations), the
  // dep array can fire twice — once from `currentSurah` advancing within
  // the same track, once from `initialScrollIndex` resolving on a later
  // render. Future implementer adding multi-surah support should add a
  // ref-based guard like `if (lastFiredForSurahRef.current === currentSurah
  // && lastFiredForIndexRef.current === initialScrollIndex) return;`
  // before the imperative scroll. Out of scope for RFC-013 v1.
  useEffect(() => {
    if (!listRef.current) return;
    setIsLocked(true);
    if (initialScrollIndex !== undefined) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            listRef.current?.scrollToIndex({
              index: initialScrollIndex,
              animated: false,
              viewPosition: 0.05,
              viewOffset: -headerHeightRef.current,
            });
          } catch {
            listRef.current?.scrollToOffset({offset: 0, animated: false});
          }
        });
      });
    } else {
      listRef.current.scrollToOffset({offset: 0, animated: false});
    }
  }, [currentSurah, initialScrollIndex, setIsLocked]);

  // Auto-scroll to active ayah (only when locked)
  useEffect(() => {
    if (!currentVerseKey || !isLocked || !listRef.current) return;

    const index = verses.findIndex(v => v.verse_key === currentVerseKey);
    if (index === -1) return;

    try {
      listRef.current.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.3,
        viewOffset: -headerHeightRef.current,
      });
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
      showAllahNameHighlight,
      allahNameHighlightColor,
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
        extraData={`${showWBW}-${wbwShowTranslation}-${wbwShowTransliteration}-${showTajweed}-${arabicFontSize}-${arabicTextWeight}-${showTranslation}-${showTransliteration}-${showAllahNameHighlight}-${allahNameHighlightColor}`}
        keyExtractor={keyExtractor}
        initialScrollIndex={initialScrollIndex}
        ListHeaderComponent={
          <View onLayout={handleHeaderLayout}>
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
              showAllahNameHighlight={showAllahNameHighlight}
              allahNameHighlightColor={allahNameHighlightColor}
            />
          </View>
        }
        contentContainerStyle={{
          paddingTop: effectivePaddingTop,
          paddingBottom: effectivePaddingBottom,
        }}
        // RFC-014: conditional spread keeps prop-shape parity with
        // upstream's no-fork path when scrollBehavior === 'native'.
        {...(renderScrollComponent ? {renderScrollComponent} : {})}
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
                viewOffset: -headerHeightRef.current,
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
