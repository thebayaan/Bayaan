import React, {
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {View, Platform} from 'react-native';
import {FlashList, type FlashListRef} from '@shopify/flash-list';
import {
  Canvas,
  Skia,
  useFonts,
  type SkFont,
  type SkParagraph,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import {SheetManager} from 'react-native-actions-sheet';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {verticalScale} from 'react-native-size-matters';
import Color from 'color';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {HIGHLIGHT_COLORS} from '@/types/verse-annotations';
import {useTheme} from '@/hooks/useTheme';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {JustService} from '@/services/mushaf/JustificationService';
import {mushafLayoutCacheService} from '@/services/mushaf/MushafLayoutCacheService';
import {rewayahDiffService} from '@/services/mushaf/RewayahDiffService';
import {
  quranTextService,
  PAGE_WIDTH,
  MARGIN,
  FONTSIZE,
} from '@/services/mushaf/QuranTextService';
import {getLineTajweedMap} from '@/services/mushaf/TajweedMappingService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import SkiaLine from './SkiaLine';
import SkiaSurahHeader from './SkiaSurahHeader';
import {SCREEN_WIDTH, CONTENT_WIDTH, BASE_LINE_HEIGHT} from '../constants';

// Pre-compute rendering constants (derived from screen dimensions, never change)
const renderScale = CONTENT_WIDTH / PAGE_WIDTH;
const skiaMargin = MARGIN * renderScale;
const lineWidth = CONTENT_WIDTH - 2 * skiaMargin;
const skiaFontSize = FONTSIZE * renderScale * 0.9;
const fontSizeLineWidthRatio = skiaFontSize / lineWidth;
const canvasMarginX = (SCREEN_WIDTH - CONTENT_WIDTH) / 2;

const TOTAL_PAGES = 604;
const pages = Array.from({length: TOTAL_PAGES}, (_, i) => i + 1);

// Reverse lookup: verseKey → page number (built lazily)
let verseToPageMap: Map<string, number> | null = null;

function getPageForVerse(verseKey: string): number | null {
  if (!verseToPageMap) {
    if (!digitalKhattDataService.initialized) return null;
    verseToPageMap = new Map();
    for (let page = 1; page <= 604; page++) {
      const keys = mushafVerseMapService.getOrderedVerseKeysForPage(page);
      for (const key of keys) {
        if (!verseToPageMap.has(key)) {
          verseToPageMap.set(key, page);
        }
      }
    }
  }
  return verseToPageMap.get(verseKey) ?? null;
}

interface ParagraphInfo {
  paragraph: SkParagraph;
  xPos: number;
}

// Public handle (same interface as ContinuousListView)
export interface ContinuousMushafViewHandle {
  scrollToPage: (page: number, animated?: boolean) => void;
  scrollToSurah: (surahId: number, animated?: boolean) => void;
  scrollToVerse: (verseKey: string, animated?: boolean) => void;
}

interface ContinuousMushafViewProps {
  textColor: string;
  dividerColor: string;
  onTap?: () => void;
  initialPage: number;
  onCurrentPageChange?: (page: number) => void;
}

// ── Per-page content with gestures + highlights ──────────

interface MushafPageContentProps {
  pageNumber: number;
  fontMgr: SkTypefaceFontProvider;
  textColor: string;
  dividerColor: string;
  showTajweed: boolean;
  indexedTajweedData: IndexedTajweedData | null;
  fontFamily: string;
  rewayah: string;
  showRewayahDiffs: boolean;
  dividerFont: SkFont | null;
  nameFontSize: number;
  onTap?: () => void;
}

// Background tint for rewayah-diff words — matches SkiaPage.
const REWAYAH_DIFF_COLOR = 'rgba(255, 107, 53, 0.3)';

const EMPTY_BG_MAP = new Map<
  number,
  Array<{start: number; end: number; color: string}>
>();

const MushafPageContent: React.FC<MushafPageContentProps> = React.memo(
  ({
    pageNumber,
    fontMgr,
    textColor,
    dividerColor,
    showTajweed,
    indexedTajweedData,
    fontFamily,
    rewayah,
    showRewayahDiffs,
    dividerFont,
    nameFontSize,
    onTap,
  }) => {
    const {isDarkMode} = useTheme();

    // ── Page data ──────────────────────────────────────────
    const pageLines = useMemo(
      () => digitalKhattDataService.getPageLines(pageNumber),
      [pageNumber],
    );

    const justResults = useMemo(() => {
      const cached = JustService.getCachedPageLayout(
        fontSizeLineWidthRatio,
        pageNumber,
        fontFamily,
      );
      if (cached) return cached;
      const result = JustService.getPageLayout(
        pageNumber,
        fontSizeLineWidthRatio,
        fontMgr,
        fontFamily,
      );
      if (result.length > 0) {
        mushafLayoutCacheService.setPageLayout(pageNumber, fontFamily, result);
      }
      return result;
      // rewayah is intentionally in the dep list even though it's not read
      // directly: getCachedPageLayout/setPageLayout key the cache by rewayah
      // internally, so the memo must re-run when rewayah changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageNumber, fontMgr, fontFamily, rewayah]);

    const lineTajweedMaps = useMemo(() => {
      if (!showTajweed || !indexedTajweedData) return null;
      return pageLines.map((_, i) =>
        getLineTajweedMap(pageNumber, i, indexedTajweedData),
      );
    }, [showTajweed, indexedTajweedData, pageNumber, pageLines]);

    const canvasHeight = pageLines.length * BASE_LINE_HEIGHT;

    // ── Paragraph refs for hit testing ─────────────────────
    const paragraphMapRef = useRef<Map<number, ParagraphInfo>>(new Map());

    useEffect(() => {
      paragraphMapRef.current.clear();
    }, [pageNumber]);

    const handleParagraphReady = useCallback(
      (lineIndex: number, paragraph: SkParagraph, xPos: number) => {
        paragraphMapRef.current.set(lineIndex, {paragraph, xPos});
      },
      [],
    );

    // ── Verse selection store ──────────────────────────────
    const selectedVerseKeys = useMushafVerseSelectionStore(
      s => s.selectedVerseKeys,
    );
    const selectedPageNumber = useMushafVerseSelectionStore(
      s => s.selectedPageNumber,
    );
    const selectVerse = useMushafVerseSelectionStore(s => s.selectVerse);
    const selectVerseRange = useMushafVerseSelectionStore(
      s => s.selectVerseRange,
    );

    // ── Playback + annotation highlights ───────────────────
    const persistentHighlights = useVerseAnnotationsStore(s => s.highlights);
    const playbackVerseKey = useMushafPlayerStore(s => {
      if (!s.currentVerseKey || s.playbackState === 'idle') return null;
      return s.currentVerseKey;
    });

    // ── Hit testing ────────────────────────────────────────
    const orderedVerseKeys = useMemo(
      () => mushafVerseMapService.getOrderedVerseKeysForPage(pageNumber),
      [pageNumber],
    );

    const hitTestVerse = useCallback(
      (eventX: number, eventY: number) => {
        const canvasX = eventX - canvasMarginX;
        const canvasY = eventY;

        if (
          canvasX < 0 ||
          canvasX > CONTENT_WIDTH ||
          canvasY < 0 ||
          canvasY > canvasHeight
        ) {
          return null;
        }

        const lineIndex = Math.floor(canvasY / BASE_LINE_HEIGHT);
        if (lineIndex < 0 || lineIndex >= pageLines.length) return null;

        const line = pageLines[lineIndex];
        if (!line || line.line_type === 'surah_name') return null;

        const paragraphInfo = paragraphMapRef.current.get(lineIndex);
        if (!paragraphInfo) return null;

        const paragraphX = canvasX - paragraphInfo.xPos;
        const paragraphY = canvasY - lineIndex * BASE_LINE_HEIGHT;

        const charIndex = paragraphInfo.paragraph.getGlyphPositionAtCoordinate(
          paragraphX,
          paragraphY,
        );

        return mushafVerseMapService.findVerseAtCharIndex(
          pageNumber,
          lineIndex,
          charIndex,
        );
      },
      [pageNumber, pageLines, canvasHeight],
    );

    // ── Drag gesture handlers ──────────────────────────────
    const dragStartVerseKeyRef = useRef<string | null>(null);
    const dragCurrentVerseKeyRef = useRef<string | null>(null);
    const orderedVerseKeysRef = useRef<string[]>(orderedVerseKeys);
    orderedVerseKeysRef.current = orderedVerseKeys;

    const handleDragStart = useCallback(
      (eventX: number, eventY: number) => {
        const segment = hitTestVerse(eventX, eventY);
        if (!segment) {
          dragStartVerseKeyRef.current = null;
          return;
        }
        dragStartVerseKeyRef.current = segment.verseKey;
        dragCurrentVerseKeyRef.current = segment.verseKey;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        selectVerse(segment.verseKey, pageNumber);
      },
      [hitTestVerse, selectVerse, pageNumber],
    );

    const handleDragUpdate = useCallback(
      (eventX: number, eventY: number) => {
        if (Platform.OS === 'android') return;
        const startKey = dragStartVerseKeyRef.current;
        if (!startKey) return;

        const segment = hitTestVerse(eventX, eventY);
        if (!segment) return;

        const currentKey = segment.verseKey;
        if (currentKey === dragCurrentVerseKeyRef.current) return;

        const ordered = orderedVerseKeysRef.current;
        const startIdx = ordered.indexOf(startKey);
        const currentIdx = ordered.indexOf(currentKey);
        if (startIdx === -1 || currentIdx === -1) return;

        if (currentIdx < startIdx) {
          if (dragCurrentVerseKeyRef.current !== startKey) {
            dragCurrentVerseKeyRef.current = startKey;
            selectVerse(startKey, pageNumber);
          }
          return;
        }

        dragCurrentVerseKeyRef.current = currentKey;
        const range = ordered.slice(startIdx, currentIdx + 1);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (range.length === 1) {
          selectVerse(range[0], pageNumber);
        } else {
          selectVerseRange(range, pageNumber);
        }
      },
      [hitTestVerse, selectVerse, selectVerseRange, pageNumber],
    );

    const handleDragEnd = useCallback(() => {
      const startKey = dragStartVerseKeyRef.current;
      if (!startKey) return;

      const store = useMushafVerseSelectionStore.getState();
      const keys = store.selectedVerseKeys;
      if (keys.length === 0) return;

      const firstKey = keys[0];
      const [surahStr, ayahStr] = firstKey.split(':');
      const surahNumber = parseInt(surahStr, 10);
      const ayahNumber = parseInt(ayahStr, 10);

      SheetManager.show('verse-actions', {
        payload: {
          verseKey: firstKey,
          surahNumber,
          ayahNumber,
          verseKeys: keys.length > 1 ? keys : undefined,
          source: 'mushaf',
        },
      });

      dragStartVerseKeyRef.current = null;
      dragCurrentVerseKeyRef.current = null;
    }, []);

    // ── Gestures ───────────────────────────────────────────
    const longPressDragGesture = useMemo(
      () =>
        Platform.OS === 'android'
          ? Gesture.LongPress()
              .minDuration(400)
              .maxDistance(20)
              .onStart(event => {
                'worklet';
                runOnJS(handleDragStart)(event.x, event.y);
              })
              .onEnd(() => {
                'worklet';
                runOnJS(handleDragEnd)();
              })
          : Gesture.Pan()
              .activateAfterLongPress(400)
              .minDistance(0)
              .onStart(event => {
                'worklet';
                runOnJS(handleDragStart)(event.x, event.y);
              })
              .onUpdate(event => {
                'worklet';
                runOnJS(handleDragUpdate)(event.x, event.y);
              })
              .onEnd(() => {
                'worklet';
                runOnJS(handleDragEnd)();
              }),
      [handleDragStart, handleDragUpdate, handleDragEnd],
    );

    const tapGesture = useMemo(
      () =>
        Gesture.Tap().onEnd(() => {
          'worklet';
          if (onTap) runOnJS(onTap)();
        }),
      [onTap],
    );

    const composedGesture = useMemo(
      () => Gesture.Exclusive(longPressDragGesture, tapGesture),
      [longPressDragGesture, tapGesture],
    );

    // ── Background highlights ──────────────────────────────
    const playbackBgColor = useMemo(
      () =>
        Color(textColor)
          .alpha(isDarkMode ? 0.1 : 0.12)
          .toString(),
      [textColor, isDarkMode],
    );

    const selectionBgColor = useMemo(
      () =>
        Color(textColor)
          .alpha(isDarkMode ? 0.15 : 0.18)
          .toString(),
      [textColor, isDarkMode],
    );

    const lineBackgroundHighlightsMap = useMemo<
      Map<number, Array<{start: number; end: number; color: string}>>
    >(() => {
      const hasAnnotations = Object.keys(persistentHighlights).length > 0;
      const hasPlayback = !!playbackVerseKey;
      const hasRewayahDiffs =
        showRewayahDiffs && rewayah !== 'hafs' && rewayahDiffService.hasDiffs;
      const selectedSet =
        selectedVerseKeys.length > 0 && selectedPageNumber === pageNumber
          ? new Set(selectedVerseKeys)
          : null;

      if (!hasAnnotations && !hasPlayback && !selectedSet && !hasRewayahDiffs)
        return EMPTY_BG_MAP;

      const map = new Map<
        number,
        Array<{start: number; end: number; color: string}>
      >();

      if (hasRewayahDiffs) {
        for (let lineIndex = 0; lineIndex < pageLines.length; lineIndex++) {
          const ranges = rewayahDiffService.getDiffRangesForLine(
            pageNumber,
            lineIndex,
          );
          if (ranges.length === 0) continue;
          let arr = map.get(lineIndex);
          if (!arr) {
            arr = [];
            map.set(lineIndex, arr);
          }
          for (const r of ranges) {
            arr.push({start: r.start, end: r.end, color: REWAYAH_DIFF_COLOR});
          }
        }
      }

      const addVerseHighlight = (vk: string, color: string) => {
        const verseLines = mushafVerseMapService.getVerseSegmentsForPage(
          pageNumber,
          vk,
        );
        for (const {lineIndex, segment} of verseLines) {
          let arr = map.get(lineIndex);
          if (!arr) {
            arr = [];
            map.set(lineIndex, arr);
          }
          arr.push({
            start: segment.startCharIndex,
            end: segment.endCharIndex,
            color,
          });
        }
      };

      // Layer 1: Persistent annotation highlights (lowest priority)
      for (const [verseKey, colorName] of Object.entries(
        persistentHighlights,
      )) {
        if (selectedSet?.has(verseKey)) continue;
        if (playbackVerseKey === verseKey) continue;
        const color = HIGHLIGHT_COLORS[colorName];
        if (!color) continue;
        addVerseHighlight(verseKey, color);
      }

      // Layer 2: Playback highlight (skip if selected)
      if (playbackVerseKey && !selectedSet?.has(playbackVerseKey)) {
        addVerseHighlight(playbackVerseKey, playbackBgColor);
      }

      // Layer 3: Selection highlight (highest priority)
      if (selectedSet) {
        for (const vk of selectedVerseKeys) {
          addVerseHighlight(vk, selectionBgColor);
        }
      }

      return map;
    }, [
      persistentHighlights,
      playbackVerseKey,
      playbackBgColor,
      selectedVerseKeys,
      selectedPageNumber,
      pageNumber,
      selectionBgColor,
      rewayah,
      showRewayahDiffs,
      pageLines,
    ]);

    // ── Render ─────────────────────────────────────────────
    const content = (
      <View style={{width: SCREEN_WIDTH, height: canvasHeight}}>
        <Canvas
          style={{
            width: CONTENT_WIDTH,
            height: canvasHeight,
            marginHorizontal: canvasMarginX,
          }}>
          {pageLines.map((line, lineIndex) => {
            const yPos = lineIndex * BASE_LINE_HEIGHT;

            if (line.line_type === 'surah_name') {
              if (!dividerFont) return null;
              return (
                <SkiaSurahHeader
                  key={`header-${pageNumber}-${lineIndex}`}
                  dividerFont={dividerFont}
                  fontMgr={fontMgr}
                  nameFontSize={nameFontSize}
                  surahNumber={line.surah_number}
                  yPos={yPos}
                  pageWidth={lineWidth}
                  xOffset={skiaMargin}
                  dividerColor={dividerColor}
                  nameColor={textColor}
                  lineHeight={BASE_LINE_HEIGHT}
                />
              );
            }

            if (!justResults[lineIndex]) return null;

            const lineInfo = quranTextService.getLineInfo(
              pageNumber,
              lineIndex,
            );
            let lineMargin = skiaMargin;
            if (lineInfo.lineWidthRatio !== 1) {
              const newLineWidth = lineWidth * lineInfo.lineWidthRatio;
              lineMargin += (lineWidth - newLineWidth) / 2;
            }

            return (
              <SkiaLine
                key={`${pageNumber}-${lineIndex}`}
                pageNumber={pageNumber}
                lineIndex={lineIndex}
                fontMgr={fontMgr}
                justResult={justResults[lineIndex]}
                pageWidth={CONTENT_WIDTH}
                fontSize={skiaFontSize}
                margin={lineMargin}
                yPos={yPos}
                textColor={textColor}
                charToRule={lineTajweedMaps?.[lineIndex] ?? undefined}
                fontFamily={fontFamily}
                lineHeight={BASE_LINE_HEIGHT}
                onParagraphReady={handleParagraphReady}
                backgroundHighlights={lineBackgroundHighlightsMap.get(
                  lineIndex,
                )}
              />
            );
          })}
        </Canvas>
      </View>
    );

    return (
      <GestureDetector gesture={composedGesture}>{content}</GestureDetector>
    );
  },
);

// ── Main component ───────────────────────────────────────

const ContinuousMushafView = forwardRef<
  ContinuousMushafViewHandle,
  ContinuousMushafViewProps
>(({textColor, dividerColor, onTap, initialPage, onCurrentPageChange}, ref) => {
  const insets = useSafeAreaInsets();
  const flashListRef = useRef<FlashListRef<number>>(null);

  // Font loading (fallback — prefer preloaded fontMgr)
  const hookFontMgr = useFonts({
    DigitalKhattV1: [require('@/data/mushaf/legacy/DigitalKhattQuranicV1.otf')],
    DigitalKhattV2: [
      require('@/data/mushaf/digitalkhatt/DigitalKhattFont.otf'),
    ],
    DigitalKhattIndoPak: [
      require('@/data/mushaf/indopak/DigitalKhattIndoPak.otf'),
    ],
    QuranCommon: [require('@/data/mushaf/quran-common.ttf')],
    SurahNameV4: [require('@/data/mushaf/surah-name-v4.ttf')],
  });
  const fontMgr = mushafPreloadService.fontMgr || hookFontMgr;

  // Surah header fonts (computed once from quranCommon typeface)
  const surahHeaderFonts = useMemo(() => {
    const qcTypeface = mushafPreloadService.quranCommonTypeface;
    if (!qcTypeface) return {dividerFont: null, nameFontSize: 0};
    const refFont = Skia.Font(qcTypeface, 100);
    const ids = refFont.getGlyphIDs('\uE000');
    const widths = refFont.getGlyphWidths(ids);
    const measuredW = widths[0] || 1;
    const scaledSize = (lineWidth / measuredW) * 100;
    return {
      dividerFont: Skia.Font(qcTypeface, scaledSize),
      nameFontSize: scaledSize * 0.4,
    };
  }, []);

  // Settings subscriptions
  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const rewayah = useMushafSettingsStore(s => s.rewayah);
  const showRewayahDiffs = useMushafSettingsStore(s => s.showRewayahDiffs);
  const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);

  const fontFamily =
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : mushafRenderer === 'dk_v1'
        ? 'DigitalKhattV1'
        : 'DigitalKhattV2';

  // Navigation
  const surahStartPages = digitalKhattDataService.initialized
    ? digitalKhattDataService.getSurahStartPages()
    : {};

  useImperativeHandle(ref, () => ({
    scrollToPage: (page: number, animated = false) => {
      flashListRef.current?.scrollToIndex({index: page - 1, animated});
    },
    scrollToSurah: (surahId: number, animated = false) => {
      const targetPage = surahStartPages[surahId];
      if (targetPage) {
        flashListRef.current?.scrollToIndex({
          index: targetPage - 1,
          animated,
        });
      }
    },
    scrollToVerse: (verseKey: string, animated = false) => {
      const page = getPageForVerse(verseKey);
      if (page) {
        flashListRef.current?.scrollToIndex({index: page - 1, animated});
      }
    },
  }));

  // Load annotations for visible surahs
  const loadAnnotationsForSurah = useVerseAnnotationsStore(
    s => s.loadAnnotationsForSurah,
  );
  const pageToSurah = digitalKhattDataService.initialized
    ? digitalKhattDataService.getPageToSurah()
    : {};

  const onViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: Array<{item: number}>}) => {
      if (viewableItems.length === 0) return;
      const page = viewableItems[0].item;
      onCurrentPageChange?.(page);
      const surahId = pageToSurah[page];
      if (surahId) loadAnnotationsForSurah(surahId);
    },
    [onCurrentPageChange, pageToSurah, loadAnnotationsForSurah],
  );

  const renderItem = useCallback(
    ({item}: {item: number}) => {
      if (!fontMgr) return null;
      return (
        <MushafPageContent
          pageNumber={item}
          fontMgr={fontMgr}
          textColor={textColor}
          dividerColor={dividerColor}
          showTajweed={showTajweed}
          indexedTajweedData={indexedTajweedData}
          fontFamily={fontFamily}
          rewayah={rewayah}
          showRewayahDiffs={showRewayahDiffs}
          dividerFont={surahHeaderFonts.dividerFont}
          nameFontSize={surahHeaderFonts.nameFontSize}
          onTap={onTap}
        />
      );
    },
    [
      fontMgr,
      textColor,
      dividerColor,
      showTajweed,
      indexedTajweedData,
      fontFamily,
      rewayah,
      showRewayahDiffs,
      surahHeaderFonts,
      onTap,
    ],
  );

  const keyExtractor = useCallback((item: number) => `page-${item}`, []);

  return (
    <FlashList
      ref={flashListRef}
      data={pages}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      initialScrollIndex={initialPage - 1}
      contentContainerStyle={{
        paddingTop: insets.top + verticalScale(60),
        paddingBottom: insets.bottom + verticalScale(80),
      }}
      showsVerticalScrollIndicator={false}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{itemVisiblePercentThreshold: 50}}
    />
  );
});

export default React.memo(ContinuousMushafView);
