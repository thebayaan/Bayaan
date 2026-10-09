import React, {
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useImperativeHandle,
  useSyncExternalStore,
  forwardRef,
} from 'react';
import {View, Platform} from 'react-native';
import {FlashList, type FlashListRef} from '@shopify/flash-list';
import {
  Canvas,
  Skia,
  type SkFont,
  type SkParagraph,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-worklets';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {verticalScale} from 'react-native-size-matters';
import Color from 'color';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import type {MushafArabicTextWeight} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {
  BOOKMARK_HIGHLIGHT_COLOR,
  HIGHLIGHT_COLORS,
} from '@/types/verse-annotations';
import {useTheme} from '@/hooks/useTheme';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {
  digitalKhattDataService,
  getRewayahFontFamily,
} from '@/services/mushaf/DigitalKhattDataService';
import {JustService} from '@/services/mushaf/JustificationService';
import {mushafLayoutCacheService} from '@/services/mushaf/MushafLayoutCacheService';
import {
  quranTextService,
  PAGE_WIDTH,
  MARGIN,
  FONTSIZE,
} from '@/services/mushaf/QuranTextService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {parseAnchorKey} from '@/services/mushaf/RewayahVerseUnits'; // @ai
import {rewayahVerseUnitsService} from '@/services/mushaf/RewayahVerseUnitsService'; // @ai
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import SkiaLine from './SkiaLine';
import SkiaSurahHeader from './SkiaSurahHeader';
import {
  computeLineAllahNameColorMaps,
  computeLineCharRuleMaps,
  computeLineTajweedMaps,
  computePageDiffBackgrounds,
  getPageTextIdentity, // @ai
  isRewayahDiffPaintEnabled,
  isTajweedEnabled,
} from './pageOverlays';
// @ai-start
import {computeUnitPageHighlightLayers} from './verseHighlightLayers';
import {usePlaybackBand} from './playbackBand';
import {useVerseUnitDragSelect, type LineCharHit} from './verseUnitDragSelect';
// @ai-end
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

// Reverse lookup: HAFS verseKey → page number (built lazily from the verse
// map, rebuilt whenever the active rewayah or the DK words cache changes).
// scrollToVerse callers (playback page turns, search) pass Hafs keys. @ai
let verseToPageMap: Map<string, number> | null = null;
let verseToPageMapRewayah: string | null = null;
let verseToPageMapVersion = -1;

function getPageForVerse(verseKey: string): number | null {
  const rewayah = digitalKhattDataService.rewayah;
  const version = digitalKhattDataService.getCacheVersion();
  if (rewayah !== verseToPageMapRewayah || version !== verseToPageMapVersion) {
    verseToPageMap = null;
    verseToPageMapRewayah = rewayah;
    verseToPageMapVersion = version;
  }
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
  // @ai-start
  /** Identity of the text drawn (getPageTextIdentity); char-offset memos
   *  depend on it. */
  textIdentity: string | null;
  // @ai-end
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
    textIdentity, // @ai
    dividerFont,
    nameFontSize,
    onTap,
    render,
  }) => {
    const {isDarkMode} = useTheme();
    // @ai-start
    // Verse units are built after interactions, in chunks, never while a page
    // renders: when a build ends, the verse layers below are computed again
    // (getShownVerseUnits() is null until then: no verse painted).
    const verseUnitsVersion = useSyncExternalStore(
      rewayahVerseUnitsService.subscribe,
      rewayahVerseUnitsService.getVersion,
    );
    // @ai-end
    // Rewayah of the text this page renders (the active DK words cache). The
    // store value can lag it during a switch, so overlays gate on this one.
    const textRewayah = digitalKhattDataService.rewayah;
    const tajweedEnabled = isTajweedEnabled(showTajweed, textRewayah);
    const rewayahDiffPaintEnabled = isRewayahDiffPaintEnabled(
      showRewayahDiffs,
      textRewayah,
    );
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
      // textIdentity: re-read after a data reload.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [pageNumber, textIdentity], // @ai
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
      // rewayah/textIdentity are intentionally in the dep list even though
      // they're not read directly: the layout depends on the line text, and
      // getCachedPageLayout/setPageLayout key the cache internally.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      pageNumber,
      fontMgr,
      fontFamily,
      rewayah,
      fontSizeLineWidthRatio,
      textIdentity, // @ai
    ]);

    // Tajweed char-to-rule maps per line (Hafs text only; see pageOverlays).
    const lineTajweedMaps = useMemo(
      () =>
        computeLineTajweedMaps(
          pageNumber,
          pageLines.length,
          indexedTajweedData,
          tajweedEnabled,
        ),
      // rewayah/textRewayah/textIdentity: maps index into the rendered text.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        tajweedEnabled,
        indexedTajweedData,
        pageNumber,
        pageLines,
        rewayah,
        textRewayah,
        textIdentity, // @ai
      ],
    );

    const lineAllahNameColorMaps = useMemo(
      () =>
        computeLineAllahNameColorMaps(
          pageNumber,
          pageLines.length,
          allahNameHighlightColor,
          showAllahNameHighlight,
        ),
      // rewayah/textRewayah/textIdentity: maps index into the rendered text.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        showAllahNameHighlight,
        pageNumber,
        pageLines,
        allahNameHighlightColor,
        rewayah,
        textRewayah,
        textIdentity, // @ai
      ],
    );

    // Merged tajweed + rewayah foreground rules. Same helper and precedence
    // as SkiaPage (tajweed base → rewayah categories → silah); the rewayah
    // layer is off whenever 'Show differences' is off.
    const lineCharRuleMaps = useMemo(
      () =>
        computeLineCharRuleMaps(
          pageNumber,
          pageLines.length,
          lineTajweedMaps,
          rewayahDiffPaintEnabled,
        ),
      // rewayah/textRewayah/textIdentity: rewayahDiffService is a singleton
      // whose state follows the active rewayah and words cache.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        lineTajweedMaps,
        pageNumber,
        pageLines,
        rewayahDiffPaintEnabled,
        rewayah,
        textRewayah,
        textIdentity, // @ai
      ],
    );

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
    // @ai-start
    // Verse units of the shown text, in its rewayah's own numbering, with
    // their Hafs storage anchors (same as SkiaPage).
    const selectedVerseKeys = useMushafVerseSelectionStore(
      s => s.selectedVerseKeys,
    );
    const selectedRewayah = useMushafVerseSelectionStore(
      s => s.selectedRewayah,
    );
    const selectedPageNumber = useMushafVerseSelectionStore(
      s => s.selectedPageNumber,
    );
    // @ai-end

    // ── Playback + annotation highlights ───────────────────
    const persistentHighlights = useVerseAnnotationsStore(s => s.highlights);
    // @ai — bookmarked verses paint a persistent tint (same layer
    // ordering as SkiaPage's paged pipeline).
    const bookmarkedVerseKeys = useVerseAnnotationsStore(
      s => s.bookmarkedVerseKeys,
    );
    // @ai — the rows behind them, with the rewayah each was saved in, so
    // every row marks the units the storage rule gives (verse-units
    // contract, section 3): a Hafs row of a split Hafs verse marks both parts.
    const bookmarkRows = useVerseAnnotationsStore(s => s.bookmarkRows);
    const highlightRows = useVerseAnnotationsStore(s => s.highlightRows);
    // @ai — what the reciter is reciting, painted as verse units.
    const playbackBand = usePlaybackBand();

    // ── Hit testing ────────────────────────────────────────
    // @ai — the line and character under a touch point (this renderer's
    // paragraph metrics); which verse unit that is: useVerseUnitDragSelect.
    const charAtPoint = useCallback(
      (eventX: number, eventY: number): LineCharHit | null => {
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

        return {lineIndex, charIndex};
      },
      [pageLines, canvasHeight, canvasMarginX, contentWidth, baseLineHeight],
    );

    // ── Drag gesture handlers ──────────────────────────────
    // @ai-start
    // Long-press / iOS drag-select in verse units of the shown text, and the
    // verse actions on release (shared with SkiaPage).
    const {
      onDragStart: handleDragStart,
      onDragUpdate: handleDragUpdate,
      onDragEnd: handleDragEnd,
    } = useVerseUnitDragSelect(pageNumber, charAtPoint);
    // @ai-end

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
      // @ai-start
      // Same layers as SkiaPage (shared helper), without the theme zebra:
      // rewayah diff tints < bookmarks < colour highlights < playback <
      // selection. Every verse layer paints whole verse units of the shown
      // text: the stores' values are mapped to unit keys.
      const layers = computeUnitPageHighlightLayers({
        pageNumber,
        shown: mushafVerseMapService.getShownVerseUnits(),
        segments: mushafVerseMapService,
        diffHighlights: computePageDiffBackgrounds(
          pageNumber,
          rewayahDiffPaintEnabled,
        ),
        themes: null,
        sources: {
          bookmarkedVerseKeys,
          persistentHighlights,
          bookmarkRows,
          highlightRows,
          playback: playbackBand,
          selection:
            selectedVerseKeys.length > 0 && selectedPageNumber === pageNumber
              ? {rewayah: selectedRewayah, verseKeys: selectedVerseKeys}
              : null,
        },
        bookmarkColor: BOOKMARK_HIGHLIGHT_COLOR,
        highlightColors: HIGHLIGHT_COLORS,
        playbackColor: playbackBgColor,
        selectionColor: selectionBgColor,
      });
      return layers ?? EMPTY_BG_MAP;
      // @ai-end
      // rewayah/textRewayah/textIdentity: verse segments and diff ranges follow
      // the rendered text (singleton services; not read directly).
      // verseUnitsVersion: the shown verse units (@ai).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      persistentHighlights,
      bookmarkedVerseKeys,
      bookmarkRows, // @ai
      highlightRows, // @ai
      playbackBand, // @ai
      playbackBgColor,
      selectedVerseKeys,
      selectedRewayah, // @ai
      selectedPageNumber,
      pageNumber,
      selectionBgColor,
      rewayah,
      textRewayah,
      rewayahDiffPaintEnabled,
      pageLines,
      textIdentity, // @ai
      verseUnitsVersion, // @ai
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
                textIdentity={textIdentity} // @ai
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

    // Subscribe to preloaded fontMgr; no useFonts fallback that races
    // at first-mount.
    const fontMgr = useMushafFontMgr();

    // Surah header fonts (computed once from quranCommon typeface).
    // `fontMgr` dep mirrors the SkiaPage memo: when the preload completes
    // after this view mounted, the subscription re-renders but `lineWidth`
    // hasn't changed, so without `fontMgr` in deps the memo would stay on
    // its cached null-divider snapshot.
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
    }, [lineWidth, fontMgr]);

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
    // @ai-start
    // Identity of the text drawn (see getPageTextIdentity), passed to every
    // page so mounted pages recompute their char-offset overlays when the DK
    // words change (rewayah switch, data reload). Side-cache loads for other
    // rewayat (the player) do not change it, so they re-render no page.
    const textIdentity = useSyncExternalStore(
      digitalKhattDataService.subscribeCacheChanges,
      getPageTextIdentity,
    );
    // @ai-end

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
        // @ai — a stored anchor 'S:A:W' (a verse unit's first slot) is on
        // the page of its Hafs verse's start (verse-units invariant 8).
        const loc =
          verseKey.split(':').length === 3 ? parseAnchorKey(verseKey) : null;
        const page = getPageForVerse(
          loc ? `${loc.surah}:${loc.ayah}` : verseKey,
        );
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
            textIdentity={textIdentity} // @ai
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
        textIdentity, // @ai
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
        extraData={`${showTajweed}-${arabicTextWeight}-${showAllahNameHighlight}-${allahNameHighlightColor}-${rewayah}-${showRewayahDiffs}-${textIdentity}`} // @ai
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
