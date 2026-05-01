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
import type {MushafArabicTextWeight} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {HIGHLIGHT_COLORS} from '@/types/verse-annotations';
import {useTheme} from '@/hooks/useTheme';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {
  digitalKhattDataService,
  getRewayahFontFamily,
} from '@/services/mushaf/DigitalKhattDataService';
import {JustService} from '@/services/mushaf/JustificationService';
import {mushafLayoutCacheService} from '@/services/mushaf/MushafLayoutCacheService';
import {rewayahDiffService} from '@/services/mushaf/RewayahDiffService';
import {getLineAllahNameCharMap} from '@/services/mushaf/AllahNameHighlightService';
import {
  quranTextService,
  PAGE_WIDTH,
  MARGIN,
  FONTSIZE,
} from '@/services/mushaf/QuranTextService';
import {getLineTajweedMap} from '@/services/mushaf/TajweedMappingService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import SkiaLine from './SkiaLine';
import SkiaSurahHeader from './SkiaSurahHeader';
import {type MushafLayoutMetrics} from '../constants';

// Rendering constants are now derived from live `metrics` (see
// `useRenderConstants` below). On phones the old frozen values are
// reproduced exactly; on iPad we use the capped page width so fonts
// stay readable and lines don't overlap.
interface RenderConstants {
  screenWidth: number;
  contentWidth: number;
  pageOffsetX: number;
  baseLineHeight: number;
  renderScale: number;
  skiaMargin: number;
  lineWidth: number;
  skiaFontSize: number;
  fontSizeLineWidthRatio: number;
  canvasMarginX: number;
}

// Ratio of line-height to content-width that matches the phone's visual
// density (derived from legacy constants: 41pt line height at 412pt content
// width). Used for the continuous vertical view so each page's height stays
// proportional to its width regardless of container height.
const CONTINUOUS_LINE_HEIGHT_RATIO = 0.1;

function buildRenderConstants(metrics: MushafLayoutMetrics): RenderConstants {
  const {screenWidth, contentWidth, pageOffsetX} = metrics;
  const renderScale = contentWidth / PAGE_WIDTH;
  const skiaMargin = MARGIN * renderScale;
  const lineWidth = contentWidth - 2 * skiaMargin;
  const skiaFontSize = FONTSIZE * renderScale * 0.9;
  const fontSizeLineWidthRatio = skiaFontSize / lineWidth;
  // Horizontal offset from the FlatList item's left edge to the Canvas.
  // On phone: centers the content within the view (legacy behavior).
  // On iPad: adds `pageOffsetX` so the (capped) page sits centered in the
  // full container width.
  const canvasMarginX = pageOffsetX + (metrics.pageWidth - contentWidth) / 2;
  // Decouple line-height from container-height for the continuous view so
  // each page's vertical footprint scales with its width (preserves the
  // "continuous scroll" feel on iPad instead of each page filling the whole
  // viewport). Still honor the metric's value if it produces a tighter
  // layout (i.e. short screens).
  const baseLineHeight = Math.min(
    metrics.baseLineHeight,
    contentWidth * CONTINUOUS_LINE_HEIGHT_RATIO,
  );
  return {
    screenWidth,
    contentWidth,
    pageOffsetX,
    baseLineHeight,
    renderScale,
    skiaMargin,
    lineWidth,
    skiaFontSize,
    fontSizeLineWidthRatio,
    canvasMarginX,
  };
}

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
  /** Live layout metrics from `useMushafLayout()`. Threaded through so the
   *  continuous view responds to iPad width caps + rotation. */
  metrics: MushafLayoutMetrics;
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
  arabicTextWeight: MushafArabicTextWeight;
  showAllahNameHighlight: boolean;
  allahNameHighlightColor: string;
  rewayah: string;
  showRewayahDiffs: boolean;
  dividerFont: SkFont | null;
  nameFontSize: number;
  onTap?: () => void;
  /** Live render constants derived from `metrics`. */
  render: RenderConstants;
}

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
    arabicTextWeight,
    showAllahNameHighlight,
    allahNameHighlightColor,
    rewayah,
    showRewayahDiffs,
    dividerFont,
    nameFontSize,
    onTap,
    render,
  }) => {
    const {isDarkMode} = useTheme();
    const {
      screenWidth,
      contentWidth,
      baseLineHeight,
      skiaMargin,
      lineWidth,
      skiaFontSize,
      fontSizeLineWidthRatio,
      canvasMarginX,
    } = render;

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
    }, [pageNumber, fontMgr, fontFamily, rewayah, fontSizeLineWidthRatio]);

    const lineTajweedMaps = useMemo(() => {
      if (!showTajweed || !indexedTajweedData) return null;
      return pageLines.map((_, i) =>
        getLineTajweedMap(pageNumber, i, indexedTajweedData),
      );
    }, [showTajweed, indexedTajweedData, pageNumber, pageLines]);

    const lineAllahNameColorMaps = useMemo(() => {
      if (!showAllahNameHighlight) return null;
      return pageLines.map((_, i) => {
        const charMap = getLineAllahNameCharMap(pageNumber, i);
        if (!charMap) return null;
        const colorMap = new Map<number, string>();
        for (const key of charMap.keys()) {
          colorMap.set(key, allahNameHighlightColor);
        }
        return colorMap;
      });
    }, [
      showAllahNameHighlight,
      pageNumber,
      pageLines,
      allahNameHighlightColor,
    ]);

    // Merged tajweed + rewayah foreground rules. Mirrors SkiaPage:
    // identical helper, identical precedence (tajweed base → rewayah
    // categories → silah). Keeps the vertical continuous-mushaf renderer
    // and the paginated SkiaPage renderer in lockstep so list-mode and
    // page-mode paint the same foreground highlights.
    const lineCharRuleMaps = useMemo(() => {
      if (
        !lineTajweedMaps &&
        !rewayahDiffService.hasAnyDiffs &&
        !rewayahDiffService.hasSilahColoring
      ) {
        return null;
      }

      const maps: (Map<number, string> | null)[] = [];
      for (let i = 0; i < pageLines.length; i++) {
        const tajweed = lineTajweedMaps?.[i] ?? null;
        const rewayahMap = rewayahDiffService.getRewayahRuleMapForLine(
          pageNumber,
          i,
        );
        if (!tajweed && !rewayahMap) {
          maps.push(null);
          continue;
        }
        if (!rewayahMap) {
          maps.push(tajweed);
          continue;
        }
        if (!tajweed) {
          maps.push(rewayahMap);
          continue;
        }
        const merged = new Map(tajweed);
        for (const [k, v] of rewayahMap) merged.set(k, v);
        maps.push(merged);
      }
      return maps;
      // rewayah is in the dep list so the memo re-runs when the active
      // rewayah changes; rewayahDiffService is a singleton whose internal
      // state isn't tracked by React directly.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lineTajweedMaps, pageNumber, pageLines, rewayah]);

    const canvasHeight = pageLines.length * baseLineHeight;

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
          canvasX > contentWidth ||
          canvasY < 0 ||
          canvasY > canvasHeight
        ) {
          return null;
        }

        const lineIndex = Math.floor(canvasY / baseLineHeight);
        if (lineIndex < 0 || lineIndex >= pageLines.length) return null;

        const line = pageLines[lineIndex];
        if (!line || line.line_type === 'surah_name') return null;

        const paragraphInfo = paragraphMapRef.current.get(lineIndex);
        if (!paragraphInfo) return null;

        const paragraphX = canvasX - paragraphInfo.xPos;
        const paragraphY = canvasY - lineIndex * baseLineHeight;

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
      [
        pageNumber,
        pageLines,
        canvasHeight,
        canvasMarginX,
        contentWidth,
        baseLineHeight,
      ],
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

      // Shared pipeline with SkiaPage; both consume the same per-line
      // diff-highlight map produced by rewayahDiffService.
      if (hasRewayahDiffs) {
        const diffHighlights =
          rewayahDiffService.getPageDiffHighlightsByLine(pageNumber);
        for (const [lineIndex, entries] of diffHighlights) {
          let arr = map.get(lineIndex);
          if (!arr) {
            arr = [];
            map.set(lineIndex, arr);
          }
          for (const entry of entries) arr.push(entry);
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
      <View style={{width: screenWidth, height: canvasHeight}}>
        <Canvas
          style={{
            width: contentWidth,
            height: canvasHeight,
            marginHorizontal: canvasMarginX,
          }}>
          {pageLines.map((line, lineIndex) => {
            const yPos = lineIndex * baseLineHeight;

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
                  lineHeight={baseLineHeight}
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
                pageWidth={contentWidth}
                fontSize={skiaFontSize}
                margin={lineMargin}
                yPos={yPos}
                textColor={textColor}
                charToColor={lineAllahNameColorMaps?.[lineIndex] ?? undefined}
                charToRule={lineCharRuleMaps?.[lineIndex] ?? undefined}
                fontFamily={fontFamily}
                arabicTextWeight={arabicTextWeight}
                lineHeight={baseLineHeight}
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
MushafPageContent.displayName = 'MushafPageContent';

// ── Main component ───────────────────────────────────────

const ContinuousMushafView = forwardRef<
  ContinuousMushafViewHandle,
  ContinuousMushafViewProps
>(
  (
    {textColor, dividerColor, onTap, initialPage, onCurrentPageChange, metrics},
    ref,
  ) => {
    const insets = useSafeAreaInsets();
    const {theme} = useTheme();
    const flashListRef = useRef<FlashListRef<number>>(null);
    const render = useMemo(() => buildRenderConstants(metrics), [metrics]);
    const {lineWidth} = render;

    // Font loading (fallback — prefer preloaded fontMgr)
    const hookFontMgr = useFonts({
      DigitalKhattV1: [
        require('@/data/mushaf/legacy/DigitalKhattQuranicV1.otf'),
      ],
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
    }, [lineWidth]);

    // Settings subscriptions
    const showTajweed = useMushafSettingsStore(s => s.showTajweed);
    const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
    const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
    const showAllahNameHighlight = useMushafSettingsStore(
      s => s.showAllahNameHighlight,
    );
    const allahNameHighlightColorSetting = useMushafSettingsStore(
      s => s.allahNameHighlightColor,
    );
    const rewayah = useMushafSettingsStore(s => s.rewayah);
    const showRewayahDiffs = useMushafSettingsStore(s => s.showRewayahDiffs);
    const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);

    const fontFamily =
      getRewayahFontFamily(
        rewayah as Parameters<typeof getRewayahFontFamily>[0],
      ) ??
      (mushafRenderer === 'dk_indopak'
        ? 'DigitalKhattIndoPak'
        : mushafRenderer === 'dk_v1'
        ? 'DigitalKhattV1'
        : 'DigitalKhattV2');
    const allahNameHighlightColor = useMemo(
      () =>
        getAllahNameHighlightColorHex(
          allahNameHighlightColorSetting,
          theme.isDarkMode,
        ),
      [allahNameHighlightColorSetting, theme.isDarkMode],
    );

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
            arabicTextWeight={arabicTextWeight}
            showAllahNameHighlight={showAllahNameHighlight}
            allahNameHighlightColor={allahNameHighlightColor}
            rewayah={rewayah}
            showRewayahDiffs={showRewayahDiffs}
            dividerFont={surahHeaderFonts.dividerFont}
            nameFontSize={surahHeaderFonts.nameFontSize}
            onTap={onTap}
            render={render}
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
        arabicTextWeight,
        showAllahNameHighlight,
        allahNameHighlightColor,
        rewayah,
        showRewayahDiffs,
        surahHeaderFonts,
        onTap,
        render,
      ],
    );

    const keyExtractor = useCallback((item: number) => `page-${item}`, []);

    return (
      <FlashList
        ref={flashListRef}
        data={pages}
        renderItem={renderItem}
        extraData={`${showTajweed}-${arabicTextWeight}-${showAllahNameHighlight}-${allahNameHighlightColor}-${rewayah}-${showRewayahDiffs}`}
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
  },
);
ContinuousMushafView.displayName = 'ContinuousMushafView';

export default React.memo(ContinuousMushafView);
