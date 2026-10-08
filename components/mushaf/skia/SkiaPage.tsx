import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
} from 'react';
import {View, Platform} from 'react-native';
import {
  Canvas,
  Skia,
  type SkParagraph,
  type SkTypefaceFontProvider, // @ai
} from '@shopify/react-native-skia';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-worklets';
import {
  quranTextService,
  PAGE_WIDTH,
  MARGIN,
  FONTSIZE,
} from '@/services/mushaf/QuranTextService';
import {
  JustService,
  type JustResultByLine,
} from '@/services/mushaf/JustificationService';
import {
  digitalKhattDataService,
  getRewayahFontFamily,
  type DKLine,
} from '@/services/mushaf/DigitalKhattDataService';
import {mushafLayoutCacheService} from '@/services/mushaf/MushafLayoutCacheService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {themeDataService} from '@/services/mushaf/ThemeDataService';
import {useTajweedStore} from '@/store/tajweedStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {useTheme} from '@/hooks/useTheme';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {
  BOOKMARK_HIGHLIGHT_COLOR,
  HIGHLIGHT_COLORS,
} from '@/types/verse-annotations';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import Color from 'color';
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
import {
  SCREEN_WIDTH as DEFAULT_SCREEN_WIDTH,
  SCREEN_HEIGHT as DEFAULT_SCREEN_HEIGHT,
  PAGE_PADDING_HORIZONTAL as DEFAULT_PAGE_PADDING_HORIZONTAL,
  PAGE_PADDING_TOP as DEFAULT_PAGE_PADDING_TOP,
  CONTENT_WIDTH as DEFAULT_CONTENT_WIDTH,
  CONTENT_HEIGHT as DEFAULT_CONTENT_HEIGHT,
  BASE_LINE_HEIGHT as DEFAULT_BASE_LINE_HEIGHT,
  calculateLineYPositions,
} from '../constants';

interface ParagraphInfo {
  paragraph: SkParagraph;
  xPos: number;
}

// @ai-start
/** A page layout and the key of the text, font and size it belongs to. */
interface PageLayout {
  key: string;
  results: JustResultByLine[];
}

function pageLayoutKey(
  pageNumber: number,
  fontFamily: string,
  fontSizeLineWidthRatio: number,
  textIdentity: string | null,
): string {
  return `${pageNumber}|${fontFamily}|${fontSizeLineWidthRatio}|${textIdentity}`;
}

/**
 * Layout of a page for the text served now: the cached one (in-memory →
 * MMKV, both sync), else computed and persisted to MMKV so it survives app
 * restarts.
 */
function resolvePageLayout(
  pageNumber: number,
  fontSizeLineWidthRatio: number,
  fontMgr: SkTypefaceFontProvider,
  fontFamily: string,
): JustResultByLine[] {
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
}
// @ai-end

interface SkiaPageProps {
  pageNumber: number;
  textColor: string;
  dividerColor: string;
  contentMarginLeft?: number;
  onReady?: () => void;
  onTap?: () => void;
  /**
   * Optional layout metrics overrides. When omitted, the component falls
   * back to the module-level constants (phone-portrait defaults). iPad and
   * rotation-aware callers should pass values from `useMushafLayout()`.
   */
  screenWidth?: number;
  screenHeight?: number;
  contentWidth?: number;
  contentHeight?: number;
  baseLineHeight?: number;
  paddingHorizontal?: number;
  paddingTop?: number;
}

const SkiaPage: React.FC<SkiaPageProps> = ({
  pageNumber,
  textColor,
  dividerColor,
  contentMarginLeft,
  onReady,
  onTap,
  screenWidth: propScreenWidth,
  screenHeight: propScreenHeight,
  contentWidth: propContentWidth,
  contentHeight: propContentHeight,
  baseLineHeight: propBaseLineHeight,
  paddingHorizontal: propPaddingHorizontal,
  paddingTop: propPaddingTop,
}) => {
  const SCREEN_WIDTH = propScreenWidth ?? DEFAULT_SCREEN_WIDTH;
  const SCREEN_HEIGHT = propScreenHeight ?? DEFAULT_SCREEN_HEIGHT;
  const CONTENT_WIDTH = propContentWidth ?? DEFAULT_CONTENT_WIDTH;
  const CONTENT_HEIGHT = propContentHeight ?? DEFAULT_CONTENT_HEIGHT;
  const BASE_LINE_HEIGHT = propBaseLineHeight ?? DEFAULT_BASE_LINE_HEIGHT;
  const PAGE_PADDING_HORIZONTAL =
    propPaddingHorizontal ?? DEFAULT_PAGE_PADDING_HORIZONTAL;
  const PAGE_PADDING_TOP = propPaddingTop ?? DEFAULT_PAGE_PADDING_TOP;

  const {theme} = useTheme();
  // Subscribe to the preloaded fontMgr instead of running a parallel
  // useFonts() fallback that races at first-mount and surfaces as
  // "Couldn't create typeface for SurahNameV4" Sentry exceptions.
  const fontMgr = useMushafFontMgr();

  // Calculate rendering dimensions (hoisted above surahHeaderFonts so lineWidth is available)
  const scale = CONTENT_WIDTH / PAGE_WIDTH;
  const margin = MARGIN * scale;
  const lineWidth = CONTENT_WIDTH - 2 * margin;

  // Create scaled SkFont objects for surah header rendering (Skia Text path).
  // `fontMgr` is in the dep array even though we read `quranCommonTypeface`
  // directly from the singleton: when the subscription fires (preload
  // completes after this component mounted), `lineWidth` hasn't changed
  // and the memo would otherwise return its cached null-divider result.
  // Re-running on the fontMgr transition rebuilds the divider with the
  // now-available typeface.
  const surahHeaderFonts = useMemo(() => {
    const qcTypeface = mushafPreloadService.quranCommonTypeface;
    if (!qcTypeface) return {dividerFont: null, nameFontSize: 0};

    // Measure divider glyph at reference size to compute scale
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

  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const showThemes = useMushafSettingsStore(s => s.showThemes);
  const uthmaniFont = useMushafSettingsStore(s => s.uthmaniFont);
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
  // Identity of the text this page draws (see getPageTextIdentity): changes
  // when the DK words change (rewayah switch, data reload), not on side-cache
  // loads for other rewayat (the player), so those never re-render the page.
  // Every char-offset memo below depends on it so no overlay computed for the
  // previous text survives on a mounted page.
  const textIdentity = useSyncExternalStore(
    digitalKhattDataService.subscribeCacheChanges,
    getPageTextIdentity,
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
  const fontFamily =
    getRewayahFontFamily(
      rewayah as Parameters<typeof getRewayahFontFamily>[0],
    ) ??
    (mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : uthmaniFont === 'v1'
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

  // @ai-start
  // The selection holds verse units of the shown text in its rewayah's own
  // numbering (decision 3), with their Hafs storage anchors.
  const selectedVerseKeys = useMushafVerseSelectionStore(
    s => s.selectedVerseKeys,
  );
  const selectedRewayah = useMushafVerseSelectionStore(s => s.selectedRewayah);
  const selectedPageNumber = useMushafVerseSelectionStore(
    s => s.selectedPageNumber,
  );
  // @ai-end

  const persistentHighlights = useVerseAnnotationsStore(s => s.highlights);
  // @ai — bookmarked verses paint a persistent tint (Layer 0.5 below) so a
  // bookmark leaves a visible trace on the page; explicit colored highlights,
  // playback, and selection all paint over it.
  const bookmarkedVerseKeys = useVerseAnnotationsStore(
    s => s.bookmarkedVerseKeys,
  );
  // @ai — the rows behind them, with the rewayah each was saved in, so
  // every row marks the units the storage rule gives (verse-units
  // contract, section 3): a Hafs row of a split Hafs verse marks both parts.
  const bookmarkRows = useVerseAnnotationsStore(s => s.bookmarkRows);
  const highlightRows = useVerseAnnotationsStore(s => s.highlightRows);

  // Mushaf playback highlighting
  const {isDarkMode} = useTheme();
  // @ai — what the reciter is reciting; painted as the shown rewayah's verse
  // units (exactly the reciter's verse for a set in the shown rewayah).
  const playbackBand = usePlaybackBand();

  // Paragraph references for hit testing
  const paragraphMapRef = useRef<Map<number, ParagraphInfo>>(new Map());

  // onReady tracking; refs keep handleParagraphReady callback stable
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const readyFiredRef = useRef(false);

  const fontSize = FONTSIZE * scale * 0.9;
  const fontSizeLineWidthRatio = fontSize / lineWidth;

  // @ai-start
  // Justification of this page for the text, font and size drawn now. A
  // layout is kept with the key it was computed for and only drawn under that
  // key: SkiaLine builds each paragraph from the current line text, and a
  // layout of other text (the previous rewayah, right after a switch) would
  // put its letter stretches and spacing on the wrong characters.
  const layoutKey = pageLayoutKey(
    pageNumber,
    fontFamily,
    fontSizeLineWidthRatio,
    textIdentity,
  );
  // Initialize from synchronous cache (in-memory → MMKV, both sync)
  const [layout, setLayout] = useState<PageLayout | null>(() => {
    const cached = JustService.getCachedPageLayout(
      fontSizeLineWidthRatio,
      pageNumber,
      fontFamily,
    );
    return cached ? {key: layoutKey, results: cached} : null;
  });
  if (layout && layout.key !== layoutKey && fontMgr) {
    // The text, font or size of a page already drawn changed (e.g. a rewayah
    // switch): take the matching layout during this render, cached or
    // computed, so the previous frame stays up until it is ready instead of
    // the new text being drawn with the old layout (or a blank page).
    setLayout({
      key: layoutKey,
      results: resolvePageLayout(
        pageNumber,
        fontSizeLineWidthRatio,
        fontMgr,
        fontFamily,
      ),
    });
  }
  const justResults = layout?.key === layoutKey ? layout.results : null;
  // @ai-end

  // Get page lines for layout calculation
  const pageLines = useMemo<DKLine[]>(
    () => digitalKhattDataService.getPageLines(pageNumber),
    // textIdentity: re-read after a data reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageNumber, textIdentity], // @ai
  );

  // Compute layout if not already cached (first-launch race condition fallback)
  // @ai-start
  // Only for a page that has not been drawn yet: once it has, a change of
  // text, font or size takes its new layout during render (above).
  useEffect(() => {
    if (!fontMgr || layout) return;
    const results = resolvePageLayout(
      pageNumber,
      fontSizeLineWidthRatio,
      fontMgr,
      fontFamily,
    );
    // Keyed by the text served at compute time; a render that shows other
    // text never draws it (it takes its own layout above).
    setLayout({
      key: pageLayoutKey(
        pageNumber,
        fontFamily,
        fontSizeLineWidthRatio,
        getPageTextIdentity(),
      ),
      results,
    });
  }, [fontMgr, layout, pageNumber, fontSizeLineWidthRatio, fontFamily]);
  // @ai-end

  // Calculate Y positions for each line
  const lineYPositions = useMemo(
    () =>
      calculateLineYPositions(
        pageLines,
        pageNumber,
        CONTENT_HEIGHT,
        BASE_LINE_HEIGHT,
      ),
    [pageLines, pageNumber, CONTENT_HEIGHT, BASE_LINE_HEIGHT],
  );

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

  // Merged char-to-rule maps: tajweed as base, rewayah foreground categories
  // (+ silah) layered on top so rewayah rules win on overlap. The rewayah
  // layer is shared with ContinuousMushafView (pageOverlays) and is off
  // whenever 'Show differences' is off.
  const lineCharRuleMaps = useMemo(
    () =>
      computeLineCharRuleMaps(
        pageNumber,
        pageLines.length,
        lineTajweedMaps,
        rewayahDiffPaintEnabled,
      ),
    // rewayah/textRewayah/textIdentity: rewayahDiffService is a singleton whose
    // state follows the active rewayah and words cache.
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

  // Count lines that will render SkiaLine children: non-surah-name lines with
  // a layout result and non-empty text (SkiaLine renders nothing, and never
  // reports a paragraph, for an empty line).
  const expectedLineCount = useMemo(() => {
    if (!justResults) return 0;
    let count = 0;
    for (let i = 0; i < pageLines.length; i++) {
      if (
        justResults[i] &&
        pageLines[i].line_type !== 'surah_name' &&
        quranTextService.getLineText(pageNumber, i) !== ''
      ) {
        count++;
      }
    }
    return count;
    // textIdentity: line text can change with the words cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justResults, pageLines, pageNumber, textIdentity]); // @ai

  const expectedLineCountRef = useRef(expectedLineCount);
  expectedLineCountRef.current = expectedLineCount;

  // Clear paragraph map and reset ready state when page changes
  useEffect(() => {
    paragraphMapRef.current.clear();
    readyFiredRef.current = false;
  }, [pageNumber]);

  // Edge case: if no SkiaLine children will render, fire onReady immediately
  useEffect(() => {
    if (
      expectedLineCount === 0 &&
      fontMgr &&
      justResults &&
      !readyFiredRef.current
    ) {
      readyFiredRef.current = true;
      onReadyRef.current?.();
    }
  }, [expectedLineCount, fontMgr, justResults]);

  // Callback for SkiaLine to register its paragraph
  const handleParagraphReady = useCallback(
    (lineIndex: number, paragraph: SkParagraph, xPos: number) => {
      paragraphMapRef.current.set(lineIndex, {paragraph, xPos});

      // Fire onReady once all expected paragraphs have reported in
      if (
        !readyFiredRef.current &&
        paragraphMapRef.current.size >= expectedLineCountRef.current
      ) {
        readyFiredRef.current = true;
        onReadyRef.current?.();
      }
    },
    [],
  );

  // Callback for SkiaLine to evict its paragraph from the hit-test map right
  // before it disposes the native memory. Without this, a line that recomputes
  // to null or unmounts (page still mounted) would leave a freed pointer in the
  // map, since the map is otherwise only cleared on a pageNumber change. The
  // recompute-to-new-paragraph case re-registers via handleParagraphReady in
  // the same commit (effects flush after cleanups), so it stays consistent.
  const handleParagraphDisposed = useCallback((lineIndex: number) => {
    paragraphMapRef.current.delete(lineIndex);
  }, []);

  // Find which line a Y coordinate falls within
  const findLineAtY = useCallback(
    (canvasY: number): number => {
      for (let i = 0; i < lineYPositions.length; i++) {
        const lineTop = lineYPositions[i];
        const lineBottom =
          i < lineYPositions.length - 1
            ? lineYPositions[i + 1]
            : CONTENT_HEIGHT;
        if (canvasY >= lineTop && canvasY < lineBottom) {
          return i;
        }
      }
      return -1;
    },
    [lineYPositions],
  );

  // @ai — the line and character under a touch point (this renderer's
  // paragraph metrics); which verse unit that is: useVerseUnitDragSelect.
  const charAtPoint = useCallback(
    (eventX: number, eventY: number): LineCharHit | null => {
      const canvasX = eventX - (contentMarginLeft ?? PAGE_PADDING_HORIZONTAL);
      const canvasY = eventY - PAGE_PADDING_TOP;

      if (
        canvasX < 0 ||
        canvasX > CONTENT_WIDTH ||
        canvasY < 0 ||
        canvasY > CONTENT_HEIGHT
      ) {
        return null;
      }

      const lineIndex = findLineAtY(canvasY);
      if (lineIndex < 0) return null;

      const line = pageLines[lineIndex];
      if (!line || line.line_type === 'surah_name') return null;

      const paragraphInfo = paragraphMapRef.current.get(lineIndex);
      if (!paragraphInfo) return null;

      const paragraphX = canvasX - paragraphInfo.xPos;
      const paragraphY = canvasY - lineYPositions[lineIndex];

      const charIndex = paragraphInfo.paragraph.getGlyphPositionAtCoordinate(
        paragraphX,
        paragraphY,
      );

      return {lineIndex, charIndex};
    },
    [pageLines, lineYPositions, findLineAtY, contentMarginLeft],
  );

  // @ai-start
  // Long-press / iOS drag-select in verse units of the shown text, and the
  // verse actions on release (shared with ContinuousMushafView).
  const {
    onDragStart: handleDragStart,
    onDragUpdate: handleDragUpdate,
    onDragEnd: handleDragEnd,
  } = useVerseUnitDragSelect(pageNumber, charAtPoint);
  // @ai-end

  const longPressDragGesture = useMemo(
    () =>
      Platform.OS === 'android'
        ? // Android: use a true LongPress gesture (requires finger to stay still)
          Gesture.LongPress()
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
        : // iOS: Pan with long press delay allows drag-to-select range
          Gesture.Pan()
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

  // Compute per-line background highlight arrays for all highlight types
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

  const EMPTY_BG_MAP = useMemo(
    () => new Map<number, Array<{start: number; end: number; color: string}>>(),
    [],
  );

  const lineBackgroundHighlightsMap = useMemo<
    Map<number, Array<{start: number; end: number; color: string}>>
  >(() => {
    // @ai-start
    // Layers (rewayah diff tints < themes < bookmarks < colour highlights <
    // playback < selection) are built by the helper shared with
    // ContinuousMushafView. Diff tints use a saturated orange so differing
    // words pop out as a study aid; a bookmarked verse keeps a persistent
    // tint unless a colour highlight, playback or selection paints over it.
    // Every verse layer paints whole verse units of the shown text (its
    // rewayah's own verses): the stores' values are mapped to unit keys.
    const layers = computeUnitPageHighlightLayers({
      pageNumber,
      shown: mushafVerseMapService.getShownVerseUnits(),
      segments: mushafVerseMapService,
      diffHighlights: computePageDiffBackgrounds(
        pageNumber,
        rewayahDiffPaintEnabled,
      ),
      themes: showThemes
        ? {
            color: Color(textColor).alpha(0.12).toString(),
            themeIndexOfHafsVerse: hafsKey =>
              themeDataService.getThemeForVerse(hafsKey)?.themeIndex,
          }
        : null,
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
    EMPTY_BG_MAP,
    showThemes,
    textColor,
    rewayah,
    textRewayah,
    rewayahDiffPaintEnabled,
    textIdentity, // @ai
  ]);

  const pageStyle = {width: SCREEN_WIDTH, height: SCREEN_HEIGHT};

  if (!fontMgr || !justResults) {
    return <View style={pageStyle} />;
  }

  const content = (
    <View style={pageStyle}>
      <Canvas
        style={{
          width: CONTENT_WIDTH,
          height: CONTENT_HEIGHT,
          marginLeft: contentMarginLeft ?? PAGE_PADDING_HORIZONTAL,
          marginTop: PAGE_PADDING_TOP,
        }}>
        {pageLines.map((line, lineIndex) => {
          if (line.line_type === 'surah_name') {
            if (!surahHeaderFonts.dividerFont || !fontMgr) return null;
            return (
              <SkiaSurahHeader
                key={`surah-header-${pageNumber}-${lineIndex}`}
                dividerFont={surahHeaderFonts.dividerFont}
                fontMgr={fontMgr}
                nameFontSize={surahHeaderFonts.nameFontSize}
                surahNumber={line.surah_number}
                yPos={lineYPositions[lineIndex]}
                pageWidth={lineWidth}
                xOffset={margin}
                dividerColor={dividerColor}
                nameColor={textColor}
                lineHeight={
                  lineIndex < lineYPositions.length - 1
                    ? lineYPositions[lineIndex + 1] - lineYPositions[lineIndex]
                    : CONTENT_HEIGHT - lineYPositions[lineIndex]
                }
              />
            );
          }
          if (!justResults[lineIndex]) return null;

          const yPos = lineYPositions[lineIndex];

          const lineInfo = quranTextService.getLineInfo(pageNumber, lineIndex);
          let lineMargin = margin;
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
              fontSize={fontSize}
              margin={lineMargin}
              yPos={yPos}
              textColor={textColor}
              charToRule={lineCharRuleMaps?.[lineIndex] ?? undefined}
              charToColor={lineAllahNameColorMaps?.[lineIndex] ?? undefined}
              fontFamily={fontFamily}
              arabicTextWeight={arabicTextWeight}
              textIdentity={textIdentity} // @ai
              onParagraphReady={handleParagraphReady}
              onParagraphDisposed={handleParagraphDisposed}
              backgroundHighlights={lineBackgroundHighlightsMap.get(lineIndex)}
              lineHeight={
                lineIndex < lineYPositions.length - 1
                  ? lineYPositions[lineIndex + 1] - lineYPositions[lineIndex]
                  : CONTENT_HEIGHT - lineYPositions[lineIndex]
              }
            />
          );
        })}
      </Canvas>
    </View>
  );

  return <GestureDetector gesture={composedGesture}>{content}</GestureDetector>;
};

export default React.memo(SkiaPage);
