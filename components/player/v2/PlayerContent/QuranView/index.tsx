import React, {useCallback, useRef, useEffect, useState, useMemo} from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  type LayoutChangeEvent,
  ActivityIndicator, // @ai
  Text, // @ai
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
import {
  getDkFontFamily, // @ai
  useMushafSettingsStore,
} from '@/store/mushafSettingsStore';
import type {
  MushafArabicTextWeight,
  RewayahId,
} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import {useTimestampStore} from '@/store/timestampStore';
import {
  getRegisteredTimingNumbering, // @ai
  parseVerseKeyListId, // @ai
  selectTrackedVerseKeysId, // @ai
} from '@/utils/timestampNumbering';
import {
  enhancedVersesBySurah,
  rebuildEnhancedVerses,
  type EnhancedVerse,
} from '@/utils/enhancedVerseData';
import {getTranslationName} from '@/utils/translationLookup';
import {useCurrentTrackRewayah} from '@/hooks/useCurrentTrackRewayah';
import {usePlayerStore} from '@/services/player/store/playerStore';
import branding from '@/config/branding';
// @ai-start
import {
  useRewayahVerseUnits,
  type RewayahVerseUnitsStatus,
} from '@/hooks/useRewayahVerseUnits';
import {getShortLabel} from '@/services/rewayah/RewayahIdentity';
import {
  buildVerseUnitRows,
  isVerseUnitRow,
  playbackBandKeysId,
  rowIndexForHafsReference,
  type VerseUnitRow,
} from './verseUnitRows';
// @ai-end

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
  /** Rewayah of the verses below (the playing track's rewayah). */
  rewayah: RewayahId;
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
    rewayah,
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
        rewayah={rewayah}
      />
    </>
  ),
);
QuranListHeader.displayName = 'QuranListHeader';

// @ai-start
/**
 * In place of the verse list while a non-Hafs track's verse units are not
 * ready: a spinner while its words load, else a short message. Never the
 * Hafs verse rows meanwhile: they would show Hafs numbers under the
 * rewayah's name.
 */
function VerseUnitsPendingView({
  status,
  rewayah,
  color,
}: {
  status: RewayahVerseUnitsStatus;
  rewayah: RewayahId;
  color: string;
}) {
  return (
    <View style={styles.pending} testID="verse-units-pending">
      {status === 'loading' ? (
        <ActivityIndicator
          size="small"
          color={color}
          accessibilityLabel={`Loading the ${getShortLabel(rewayah)} verses`}
        />
      ) : (
        <Text style={[styles.pendingText, {color}]}>
          {`Couldn't load the ${getShortLabel(rewayah)} verses.`}
        </Text>
      )}
    </View>
  );
}
// @ai-end

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
  // @ai-start
  // Decision 3 (Release 1): a non-Hafs track lists its rewayah's OWN verses
  // (verse units, in the rewayah's numbering: Warsh 1:6 is the first part of
  // Hafs 1:7, Warsh 2:1 holds Hafs 2:1 and 2:2), never Hafs verses under the
  // rewayah's name. A Hafs track keeps its Hafs verse rows exactly as before
  // and never loads verse units.
  const unitsRewayah = trackRewayah === 'hafs' ? null : trackRewayah;
  const {units: verseUnits, status: verseUnitsStatus} =
    useRewayahVerseUnits(unitsRewayah);
  // @ai-end

  // Ayah timestamp tracking. currentVerseKey (the first Hafs verse being
  // recited) drives scrolling; every Hafs verse the reciter is reciting is
  // highlighted (a reciter verse can cover several Hafs verses).
  const currentVerseKey = useTimestampStore(s => s.currentAyah?.verseKey);
  // @ai-start
  const trackedVerseKeysId = useTimestampStore(selectTrackedVerseKeysId);
  const trackedVerseKeys = useMemo(
    () => parseVerseKeyListId(trackedVerseKeysId),
    [trackedVerseKeysId],
  );
  // @ai-end
  // @ai-start
  // The band of a non-Hafs track, as its verse keys (contract 4.2): exactly
  // the reciter's own verse when the timing set is numbered in this rewayah
  // (Warsh entry 6 lights Warsh 1:6, not the rest of Hafs 1:7), else every
  // verse holding a Hafs verse the entry recites. Empty for a Hafs track.
  const bandKeysId = useTimestampStore(
    useCallback(
      s =>
        verseUnits && unitsRewayah
          ? playbackBandKeysId(
              verseUnits,
              s.currentAyah,
              s.currentSurahTimestamps
                ? getRegisteredTimingNumbering(s.currentSurahTimestamps)
                : undefined,
            )
          : '',
      [verseUnits, unitsRewayah],
    ),
  );
  const bandKeys = useMemo(() => parseVerseKeyListId(bandKeysId), [bandKeysId]);
  // @ai-end
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
  const [rebuildCounter, setRebuildCounter] = useState(0); // @ai

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

  // DK Skia rendering: derive font family and fontMgr from mushafRenderer.
  // A rewayah track has no QPC (Hafs) text to fall back on, so it always
  // renders from its DK words DB, also under the Hafs-only QCF renderer,
  // instead of showing Hafs text for a Warsh/Qalun/... recitation.
  const isDK =
    (mushafRenderer === 'dk_v1' ||
      mushafRenderer === 'dk_v2' ||
      mushafRenderer === 'dk_indopak' ||
      trackRewayah !== 'hafs') &&
    mushafPreloadService.initialized &&
    digitalKhattDataService.initialized;
  // @ai-start
  // The font follows the text it draws, like the mushaf settings gating: a
  // rewayah track's text is drawn with a DigitalKhatt font that has its
  // marks, never IndoPak (Hafs only) or the QCF glyphs. Hafs tracks keep the
  // reader's font. The word-by-word grid always shows Hafs words, so it
  // keeps the reader's font too.
  const dkFontFamily = getDkFontFamily(mushafRenderer, trackRewayah);
  const wbwFontFamily = getDkFontFamily(mushafRenderer, 'hafs');
  // @ai-end
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

  // @ai-start
  // Rows of a non-Hafs track: one per verse of the rewayah (plus the
  // unnumbered Fatiha basmala of the Madani / Basri counts), its text exactly
  // its own slots, with the translation of every Hafs verse it holds (the
  // rebuilt translation included). Null for a Hafs track; [] until the units
  // are ready.
  const unitRows = useMemo<VerseUnitRow[] | null>(() => {
    if (!unitsRewayah) return null;
    if (!verseUnits || verseUnits.rewayah !== unitsRewayah) return [];
    const hafsVerses = new Map(
      (enhancedVersesBySurah[currentSurah] ?? []).map(v => [v.verse_key, v]),
    );
    return buildVerseUnitRows(verseUnits, currentSurah, hafsKey =>
      hafsVerses.get(hafsKey),
    );
    // rebuildCounter: the enhanced verses were rebuilt with a new translation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitsRewayah, verseUnits, currentSurah, rebuildCounter]);
  // What the list shows: the rewayah's verse rows, or the Hafs verses.
  const listData: EnhancedVerse[] = unitRows ?? verses;
  // The row the list follows: the tracked Hafs verse, or the first verse of
  // a non-Hafs track's band.
  const activeRowKey = unitRows ? bandKeys[0] : currentVerseKey;
  // @ai-end

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
    // @ai-start
    // The hook names a Hafs verse: a non-Hafs track lands on the rewayah
    // verse holding its start (as stored Hafs references resolve).
    if (unitRows) {
      return verseUnits
        ? rowIndexForHafsReference(unitRows, verseUnits, verseKey)
        : undefined;
    }
    // @ai-end
    const idx = verses.findIndex(v => v.verse_key === verseKey);
    return idx >= 0 ? idx : undefined;
  }, [currentTrack, verses, unitRows, verseUnits]); // @ai

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
  // @ai — hasRows: a non-Hafs track's list first mounts when its verse
  // units are ready (constant for a Hafs track, so its runs are unchanged).
  const hasRows = listData.length > 0;
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
  }, [currentSurah, initialScrollIndex, setIsLocked, hasRows]); // @ai

  // Auto-scroll to active ayah (only when locked)
  // @ai — the active row (a non-Hafs track: the band's first verse)
  useEffect(() => {
    if (!activeRowKey || !isLocked || !listRef.current) return;

    const index = listData.findIndex(v => v.verse_key === activeRowKey);
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
  }, [activeRowKey, listData, isLocked]); // @ai

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
        wbwFontFamily={wbwFontFamily} // @ai
        indexedTajweedData={indexedTajweedData}
        // @ai — a verse row: the band of the rewayah's own verses
        isActive={
          isLocked &&
          (unitRows
            ? bandKeys.includes(item.verse_key)
            : trackedVerseKeys.includes(item.verse_key))
        }
        translationName={translationName}
        translationId={selectedTranslationId}
        showWBW={showWBW}
        wbwShowTranslation={wbwShowTranslation}
        wbwShowTransliteration={wbwShowTransliteration}
        rewayah={trackRewayah}
        unitRow={isVerseUnitRow(item) ? item : undefined} // @ai
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
      wbwFontFamily, // @ai
      indexedTajweedData,
      trackedVerseKeys, // @ai
      unitRows, // @ai
      bandKeys, // @ai
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
  // @ai-start
  if (unitRows && unitRows.length === 0) {
    return (
      <View style={styles.container}>
        <VerseUnitsPendingView
          status={verseUnitsStatus}
          rewayah={trackRewayah}
          color={readingColors.textSecondary}
        />
      </View>
    );
  }
  // @ai-end

  return (
    <View style={styles.container}>
      <FlashList
        ref={listRef}
        style={{width: contentWidth, height: '100%'}}
        data={listData} // @ai
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
              rewayah={trackRewayah}
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
          // @ai — the active row (a non-Hafs track: the band's first verse)
          if (activeRowKey) {
            setIsLocked(false);
          }
        }}
      />
      {!isLocked && activeRowKey /* @ai */ && (
        <Pressable
          style={[styles.recenterButton, {backgroundColor: theme.colors.card}]}
          onPress={() => {
            setIsLocked(true);
            // @ai — the active row (a non-Hafs track: the band's first verse)
            const index = listData.findIndex(v => v.verse_key === activeRowKey);
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
  // @ai-start
  pending: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(24),
  },
  pendingText: {
    fontFamily: 'Manrope-Medium',
    fontSize: moderateScale(13),
    textAlign: 'center',
  },
  // @ai-end
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
