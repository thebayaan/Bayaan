// @ai-start
// One DigitalKhatt page of the vertical scroll (ContinuousMushafView): its
// lines, overlays, highlights and gestures.
// @ai-end
import React, {
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useSyncExternalStore,
} from 'react';
import {View, Platform} from 'react-native';
import {
  Canvas,
  type SkFont,
  type SkParagraph,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-worklets';
import Color from 'color';
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
import {useVerseUnitDragSelect, type LineCharHit} from './verseUnitDragSelect';
// @ai-end
import {canvasBottomOverflow} from '../constants'; // @ai
import {useRecitationLineHighlights} from './useRecitationLineHighlights';
import {useRecitationHiddenText} from './useRecitationHiddenText';
import {useRecitationMarkColors} from './useRecitationMarkColors';
import {SheetManager} from 'react-native-actions-sheet';
import {markAtChar} from './recitationTap';
import {useRecitationTrackingStore} from '@/store/recitationTrackingStore';
import type {RenderConstants} from './ContinuousMushafView'; // @ai

interface ParagraphInfo {
  paragraph: SkParagraph;
  xPos: number;
}

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
    // @ai — the surah whose basmala is being recited (the intro before its
    // first verse): its basmallah line is painted as a recited verse is.
    const basmalaSurah = usePlaybackBasmalaSurah();

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

    // A tap on a word marked while reciting opens it; any other tap is the
    // page's own.
    const handleTap = useCallback(
      (x: number, y: number) => {
        const {marks} = useRecitationTrackingStore.getState();
        if (marks.length > 0) {
          const hit = charAtPoint(x, y);
          const line = hit ? pageLines[hit.lineIndex] : undefined;
          const mark =
            hit && line ? markAtChar(line, hit.charIndex, marks) : null;
          if (mark) {
            void SheetManager.show('recitation-mistake', {payload: {mark}});
            return;
          }
        }
        onTap?.();
      },
      [charAtPoint, pageLines, onTap],
    );

    const tapGesture = useMemo(
      () =>
        Gesture.Tap().onEnd(event => {
          'worklet';
          runOnJS(handleTap)(event.x, event.y);
        }),
      [handleTap],
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
    const lineHighlights = useRecitationLineHighlights(
      pageNumber,
      pageLines,
      lineBackgroundHighlightsMap,
      textColor,
      isDarkMode,
    );

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
                backgroundHighlights={lineHighlights.get(lineIndex)}
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

export default MushafPageContent; // @ai
