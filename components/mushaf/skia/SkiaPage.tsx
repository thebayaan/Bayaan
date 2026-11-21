import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
} from 'react';
import {View} from 'react-native';
import {
  Canvas,
  Skia,
  type SkParagraph,
  type SkTypefaceFontProvider, // @ai
} from '@shopify/react-native-skia';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {GestureDetector} from 'react-native-gesture-handler';
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
import {rewayahVerseUnitsService} from '@/services/mushaf/RewayahVerseUnitsService'; // @ai
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
import {
  basmalaPlaybackLines, // @ai
  computeUnitPageHighlightLayers,
} from './verseHighlightLayers';
import {usePlaybackBand} from './playbackBand';
import {useRecitationLineHighlights} from './useRecitationLineHighlights';
import {useWordFlashHighlights} from './useWordFlashHighlights'; // @ai
import {useRecitationHiddenText} from './useRecitationHiddenText';
import {useRecitationMarkColors} from './useRecitationMarkColors';
import {usePlaybackBasmalaSurah} from '@/store/mushafPlayerStore'; // @ai
import {usePageTextGestures, type PageTextLayout} from './usePageTextGestures';
import {usePageHighlightColors} from './usePageHighlightColors';
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
  canvasBottomOverflow, // @ai
} from '../constants';

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
  /** @ai `centerShortPages` of the layout metrics from `getMushafLayout`. */
  centerShortPages?: boolean;
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
  centerShortPages = true, // @ai
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
  // @ai — the surah whose basmala is being recited (the intro before its
  // first verse): its basmallah line is painted as a recited verse is.
  const basmalaSurah = usePlaybackBasmalaSurah();

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
        centerShortPages, // @ai
      ),
    [pageLines, pageNumber, CONTENT_HEIGHT, BASE_LINE_HEIGHT, centerShortPages],
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

  // Reset ready state when page changes (the hit test's paragraphs start
  // empty too: usePageTextGestures)
  useEffect(() => {
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
    [lineYPositions, CONTENT_HEIGHT], // @ai
  );

  // @ai-start
  // The text canvas sits at the page padding (or contentMarginLeft), and its
  // lines at lineYPositions. The hit test, the long-press / drag-select and
  // the tap are shared with MushafPageContent.
  const textLayout = useMemo<PageTextLayout>(
    () => ({
      originX: contentMarginLeft ?? PAGE_PADDING_HORIZONTAL,
      originY: PAGE_PADDING_TOP,
      width: CONTENT_WIDTH,
      height: CONTENT_HEIGHT,
      lineAt: findLineAtY,
      lineTop: lineIndex => lineYPositions[lineIndex],
    }),
    [
      contentMarginLeft,
      PAGE_PADDING_HORIZONTAL,
      PAGE_PADDING_TOP,
      CONTENT_WIDTH,
      CONTENT_HEIGHT,
      findLineAtY,
      lineYPositions,
    ],
  );
  const {
    gesture,
    handleParagraphReady: registerParagraph,
    handleParagraphDisposed,
    paragraphCount,
  } = usePageTextGestures(pageNumber, pageLines, textLayout, onTap);

  // SkiaLine's onParagraphReady: register the paragraph, and fire onReady
  // once all expected paragraphs have reported in.
  const handleParagraphReady = useCallback(
    (lineIndex: number, paragraph: SkParagraph, xPos: number) => {
      registerParagraph(lineIndex, paragraph, xPos);
      if (
        !readyFiredRef.current &&
        paragraphCount() >= expectedLineCountRef.current
      ) {
        readyFiredRef.current = true;
        onReadyRef.current?.();
      }
    },
    [registerParagraph, paragraphCount],
  );

  // Compute per-line background highlight arrays for all highlight types
  const {playbackBgColor, selectionBgColor} = usePageHighlightColors(
    textColor,
    isDarkMode,
  );
  // @ai-end

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
      playbackBasmalaLines: basmalaPlaybackLines(
        pageLines,
        basmalaSurah,
        line => digitalKhattDataService.getBasmalaSurah(line),
        lineIndex => quranTextService.getLineText(pageNumber, lineIndex).length,
      ), // @ai
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
    basmalaSurah, // @ai
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
    verseUnitsVersion, // @ai
  ]);

  // Memorisation: words not yet recited are ghosted while hiding is on.
  // Live mistakes are drawn in the mistake colour, hidden or not.
  const lineCharColors = useRecitationMarkColors(
    pageLines,
    useRecitationHiddenText(pageLines, lineAllahNameColorMaps),
    isDarkMode,
  );

  // Recitation follow-along: recited ayat and the word being recited.
  const recitationHighlights = useRecitationLineHighlights(
    pageNumber,
    pageLines,
    lineBackgroundHighlightsMap,
    textColor,
    isDarkMode,
  );
  // @ai-start
  // The words a Quran search matched, flashed when the reader opens there.
  const lineHighlights = useWordFlashHighlights(
    pageNumber,
    pageLines,
    recitationHighlights,
    textColor,
    isDarkMode,
  );
  // @ai-end

  const pageStyle = {width: SCREEN_WIDTH, height: SCREEN_HEIGHT};

  if (!fontMgr || !justResults) {
    return <View style={pageStyle} />;
  }

  const content = (
    <View style={pageStyle}>
      <Canvas
        style={{
          width: CONTENT_WIDTH,
          // Room below the last line for its marks (canvasBottomOverflow). @ai
          height: CONTENT_HEIGHT + canvasBottomOverflow(fontSize), // @ai
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
              charToColor={lineCharColors?.[lineIndex] ?? undefined}
              fontFamily={fontFamily}
              arabicTextWeight={arabicTextWeight}
              textIdentity={textIdentity} // @ai
              onParagraphReady={handleParagraphReady}
              onParagraphDisposed={handleParagraphDisposed}
              backgroundHighlights={lineHighlights.get(lineIndex)}
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

  return <GestureDetector gesture={gesture}>{content}</GestureDetector>;
};

export default React.memo(SkiaPage);
