// @ai-start
// One DigitalKhatt page of the vertical scroll (ContinuousMushafView): its
// lines, overlays, highlights and gestures.
// @ai-end
import React, {useMemo, useSyncExternalStore} from 'react';
import {View} from 'react-native';
import {
  Canvas,
  type SkFont,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import {GestureDetector} from 'react-native-gesture-handler';
import type {MushafArabicTextWeight} from '@/store/mushafSettingsStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {
  BOOKMARK_HIGHLIGHT_COLOR,
  HIGHLIGHT_COLORS,
} from '@/types/verse-annotations';
import {useTheme} from '@/hooks/useTheme';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {JustService} from '@/services/mushaf/JustificationService';
import {mushafLayoutCacheService} from '@/services/mushaf/MushafLayoutCacheService';
import {quranTextService} from '@/services/mushaf/QuranTextService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {rewayahVerseUnitsService} from '@/services/mushaf/RewayahVerseUnitsService'; // @ai
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import SkiaLine from './SkiaLine';
import SkiaSurahHeader from './SkiaSurahHeader';
import {
  computeLineAllahNameColorMaps,
  computeLineCharRuleMaps,
  computeLineTajweedMaps,
  computePageDiffBackgrounds,
  isRewayahDiffPaintEnabled,
  isTajweedEnabled,
} from './pageOverlays';
// @ai-start
import {
  basmalaPlaybackLines, // @ai
  computeUnitPageHighlightLayers,
} from './verseHighlightLayers';
import {usePlaybackBand} from './playbackBand';
import {usePlaybackBasmalaSurah} from '@/store/mushafPlayerStore'; // @ai
import {usePageTextGestures, type PageTextLayout} from './usePageTextGestures';
import {usePageHighlightColors} from './usePageHighlightColors';
// @ai-end
import {canvasBottomOverflow} from '../constants'; // @ai
import {useRecitationLineHighlights} from './useRecitationLineHighlights';
import {useWordFlashHighlights} from './useWordFlashHighlights'; // @ai
import {useRecitationHiddenText} from './useRecitationHiddenText';
import {useRecitationMarkColors} from './useRecitationMarkColors';
import type {RenderConstants} from './continuousRenderConstants'; // @ai

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
  // @ai-start
  /** The page's height in the list (its getItemLayout entry): the one value
   *  the list and the page both use. */
  pageHeight: number;
  // @ai-end
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
    pageHeight, // @ai
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

    const canvasHeight = pageHeight; // @ai

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
    // @ai — the surah whose basmala is being recited (the intro before its
    // first verse): its basmallah line is painted as a recited verse is.
    const basmalaSurah = usePlaybackBasmalaSurah();

    // ── Touch: hit test, gestures, tap ─────────────────────
    // @ai-start
    // The text canvas starts canvasMarginX from the page's left and at its
    // top, and its lines are baseLineHeight apart. The hit test, the
    // long-press / drag-select and the tap are shared with SkiaPage.
    const textLayout = useMemo<PageTextLayout>(
      () => ({
        originX: canvasMarginX,
        originY: 0,
        width: contentWidth,
        height: canvasHeight,
        lineAt: canvasY => Math.floor(canvasY / baseLineHeight),
        lineTop: lineIndex => lineIndex * baseLineHeight,
      }),
      [canvasMarginX, contentWidth, canvasHeight, baseLineHeight],
    );
    const {gesture, handleParagraphReady, handleParagraphDisposed} =
      usePageTextGestures(pageNumber, pageLines, textLayout, onTap);

    // ── Background highlights ──────────────────────────────
    const {playbackBgColor, selectionBgColor} = usePageHighlightColors(
      textColor,
      isDarkMode,
    );
    // @ai-end

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
        playbackBasmalaLines: basmalaPlaybackLines(
          pageLines,
          basmalaSurah,
          line => digitalKhattDataService.getBasmalaSurah(line),
          lineIndex =>
            quranTextService.getLineText(pageNumber, lineIndex).length,
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
      rewayah,
      textRewayah,
      rewayahDiffPaintEnabled,
      pageLines,
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

    // ── Render ─────────────────────────────────────────────
    const content = (
      <View
        style={{
          width: screenWidth,
          height: canvasHeight,
          overflow: 'visible', // @ai
        }}>
        <Canvas
          style={{
            width: contentWidth,
            // Runs past the page footprint by canvasBottomOverflow so the
            // last line's marks are not cut; the scroll layout is unchanged.
            height: canvasHeight + canvasBottomOverflow(skiaFontSize), // @ai
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
                charToColor={lineCharColors?.[lineIndex] ?? undefined}
                charToRule={lineCharRuleMaps?.[lineIndex] ?? undefined}
                fontFamily={fontFamily}
                arabicTextWeight={arabicTextWeight}
                textIdentity={textIdentity} // @ai
                lineHeight={baseLineHeight}
                onParagraphReady={handleParagraphReady}
                onParagraphDisposed={handleParagraphDisposed} // @ai
                backgroundHighlights={lineHighlights.get(lineIndex)}
              />
            );
          })}
        </Canvas>
      </View>
    );

    return <GestureDetector gesture={gesture}>{content}</GestureDetector>;
  },
);
MushafPageContent.displayName = 'MushafPageContent';

export default MushafPageContent; // @ai
