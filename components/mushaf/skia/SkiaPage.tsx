import React, {useMemo, useState, useEffect, useRef, useCallback} from 'react';
import {View, StyleSheet} from 'react-native';
import {Canvas, useFonts, type SkParagraph} from '@shopify/react-native-skia';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {SheetManager} from 'react-native-actions-sheet';
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
  type DKLine,
} from '@/services/mushaf/DigitalKhattDataService';
import {getLineTajweedMap} from '@/services/mushaf/TajweedMappingService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {useTajweedStore} from '@/store/tajweedStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {HIGHLIGHT_COLORS} from '@/types/verse-annotations';
import SkiaLine from './SkiaLine';
import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  PAGE_PADDING_HORIZONTAL,
  PAGE_PADDING_TOP,
  CONTENT_WIDTH,
  CONTENT_HEIGHT,
  calculateLineYPositions,
} from '../constants';

// Module-level shared font state for pre-computation from outside the component
let sharedFontMgr: ReturnType<typeof useFonts> = null;
let sharedFontFamily = 'DigitalKhattV2';
let sharedFontSizeLineWidthRatio = 0;

/**
 * Pre-compute page layout synchronously so the page renders instantly
 * when the FlatList scrolls to it. Call before scrollToIndex.
 */
export function precomputePageLayout(pageNumber: number): boolean {
  if (!sharedFontMgr || !sharedFontSizeLineWidthRatio) return false;

  const cached = JustService.getCachedPageLayout(
    sharedFontSizeLineWidthRatio,
    pageNumber,
    sharedFontFamily,
  );
  if (cached) return true;

  JustService.getPageLayout(
    pageNumber,
    sharedFontSizeLineWidthRatio,
    sharedFontMgr,
    sharedFontFamily,
  );
  return true;
}

interface ParagraphInfo {
  paragraph: SkParagraph;
  xPos: number;
}

interface SkiaPageProps {
  pageNumber: number;
  textColor: string;
  highlightColor: string;
}

const SkiaPage: React.FC<SkiaPageProps> = ({
  pageNumber,
  textColor,
  highlightColor,
}) => {
  const fontMgr = useFonts({
    DigitalKhattV1: [require('@/data/mushaf/legacy/DigitalKhattQuranicV1.otf')],
    DigitalKhattV2: [require('@/data/mushaf/digitalkhatt/DigitalKhattV2.otf')],
  });

  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const uthmaniFont = useMushafSettingsStore(s => s.uthmaniFont);
  const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);
  const fontFamily = uthmaniFont === 'v1' ? 'DigitalKhattV1' : 'DigitalKhattV2';

  const selectedVerseKey = useMushafVerseSelectionStore(
    s => s.selectedVerseKey,
  );
  const selectedPageNumber = useMushafVerseSelectionStore(
    s => s.selectedPageNumber,
  );
  const selectVerse = useMushafVerseSelectionStore(s => s.selectVerse);

  const persistentHighlights = useVerseAnnotationsStore(s => s.highlights);

  // Paragraph references for hit testing
  const paragraphMapRef = useRef<Map<number, ParagraphInfo>>(new Map());

  // Calculate rendering dimensions
  const scale = CONTENT_WIDTH / PAGE_WIDTH;
  const margin = MARGIN * scale;
  const lineWidth = CONTENT_WIDTH - 2 * margin;
  const fontSize = FONTSIZE * scale * 0.9;
  const fontSizeLineWidthRatio = fontSize / lineWidth;

  // Keep shared font state in sync for precomputePageLayout
  useEffect(() => {
    if (fontMgr) {
      sharedFontMgr = fontMgr;
      sharedFontFamily = fontFamily;
      sharedFontSizeLineWidthRatio = fontSizeLineWidthRatio;
    }
  }, [fontMgr, fontFamily, fontSizeLineWidthRatio]);

  // Initialize from synchronous in-memory cache to avoid blank frames
  const [justResults, setJustResults] = useState<JustResultByLine[] | null>(
    () =>
      JustService.getCachedPageLayout(
        fontSizeLineWidthRatio,
        pageNumber,
        fontFamily,
      ) ?? null,
  );

  // Track which page the current justResults belongs to
  const justResultsPageRef = useRef<number | null>(
    justResults ? pageNumber : null,
  );

  // Get page lines for layout calculation
  const pageLines = useMemo<DKLine[]>(
    () => digitalKhattDataService.getPageLines(pageNumber),
    [pageNumber],
  );

  // Calculate justification — try sync cache first, fall back to async
  useEffect(() => {
    if (!fontMgr) return;

    // Sync cache hit — use immediately, no blank frame
    const syncCached = JustService.getCachedPageLayout(
      fontSizeLineWidthRatio,
      pageNumber,
      fontFamily,
    );
    if (syncCached) {
      setJustResults(syncCached);
      justResultsPageRef.current = pageNumber;

      // Pre-warm adjacent pages in the background
      requestAnimationFrame(() => {
        JustService.prewarmPageRange(
          pageNumber,
          2,
          fontSizeLineWidthRatio,
          fontMgr,
          fontFamily,
        );
      });
      return;
    }

    // Async fallback — check storage then compute
    let cancelled = false;

    const computeLayout = async () => {
      const cached = await JustService.getLayoutFromStorage(
        fontSizeLineWidthRatio,
        fontFamily,
      );
      if (cached && cached[pageNumber - 1]) {
        if (!cancelled) {
          setJustResults(cached[pageNumber - 1]);
          justResultsPageRef.current = pageNumber;
        }
        return;
      }

      const result = JustService.getPageLayout(
        pageNumber,
        fontSizeLineWidthRatio,
        fontMgr,
        fontFamily,
      );
      if (!cancelled) {
        setJustResults(result);
        justResultsPageRef.current = pageNumber;

        // Pre-warm adjacent pages after first compute
        requestAnimationFrame(() => {
          JustService.prewarmPageRange(
            pageNumber,
            2,
            fontSizeLineWidthRatio,
            fontMgr,
            fontFamily,
          );
        });
      }
    };

    computeLayout();
    return () => {
      cancelled = true;
    };
  }, [fontMgr, pageNumber, fontSizeLineWidthRatio, fontFamily]);

  // Calculate Y positions for each line
  const lineYPositions = useMemo(
    () => calculateLineYPositions(pageLines, pageNumber),
    [pageLines, pageNumber],
  );

  // Compute tajweed char-to-rule maps for each line
  const lineTajweedMaps = useMemo(() => {
    if (!showTajweed || !indexedTajweedData) return null;
    const maps: (Map<number, string> | null)[] = [];
    for (let i = 0; i < pageLines.length; i++) {
      maps.push(getLineTajweedMap(pageNumber, i, indexedTajweedData));
    }
    return maps;
  }, [showTajweed, indexedTajweedData, pageNumber, pageLines]);

  // Clear paragraph map when page changes
  useEffect(() => {
    paragraphMapRef.current.clear();
  }, [pageNumber]);

  // Callback for SkiaLine to register its paragraph
  const handleParagraphReady = useCallback(
    (lineIndex: number, paragraph: SkParagraph, xPos: number) => {
      paragraphMapRef.current.set(lineIndex, {paragraph, xPos});
    },
    [],
  );

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

  // Long press handler — runs on JS thread via runOnJS
  const handleLongPress = useCallback(
    (eventX: number, eventY: number) => {
      const canvasX = eventX - PAGE_PADDING_HORIZONTAL;
      const canvasY = eventY - PAGE_PADDING_TOP;

      if (
        canvasX < 0 ||
        canvasX > CONTENT_WIDTH ||
        canvasY < 0 ||
        canvasY > CONTENT_HEIGHT
      ) {
        return;
      }

      const lineIndex = findLineAtY(canvasY);
      if (lineIndex < 0) return;

      const line = pageLines[lineIndex];
      if (!line || line.line_type === 'surah_name') return;

      const paragraphInfo = paragraphMapRef.current.get(lineIndex);
      if (!paragraphInfo) return;

      const paragraphX = canvasX - paragraphInfo.xPos;
      const paragraphY = canvasY - lineYPositions[lineIndex];

      const charIndex = paragraphInfo.paragraph.getGlyphPositionAtCoordinate(
        paragraphX,
        paragraphY,
      );

      const verseSegment = mushafVerseMapService.findVerseAtCharIndex(
        pageNumber,
        lineIndex,
        charIndex,
      );

      if (verseSegment) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        selectVerse(verseSegment.verseKey, pageNumber);
        SheetManager.show('verse-actions', {
          payload: {
            verseKey: verseSegment.verseKey,
            surahNumber: verseSegment.surahNumber,
            ayahNumber: verseSegment.ayahNumber,
          },
        });
      }
    },
    [pageNumber, pageLines, lineYPositions, findLineAtY, selectVerse],
  );

  // Long press gesture for verse selection
  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(400)
        .onStart(event => {
          'worklet';
          runOnJS(handleLongPress)(event.x, event.y);
        }),
    [handleLongPress],
  );

  // Compute per-line highlight arrays merging persistent annotations + temporary selection
  const lineHighlightsMap = useMemo<
    Map<number, Array<{start: number; end: number; color: string}>>
  >(() => {
    const map = new Map<
      number,
      Array<{start: number; end: number; color: string}>
    >();

    // Persistent annotation highlights
    for (const [verseKey, colorName] of Object.entries(persistentHighlights)) {
      const hex = HIGHLIGHT_COLORS[colorName];
      if (!hex) continue;
      const verseLines = mushafVerseMapService.getVerseSegmentsForPage(
        pageNumber,
        verseKey,
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
          color: hex,
        });
      }
    }

    // Temporary selection highlight (takes priority — added last so find() returns it first)
    if (selectedVerseKey && selectedPageNumber === pageNumber) {
      const verseLines = mushafVerseMapService.getVerseSegmentsForPage(
        pageNumber,
        selectedVerseKey,
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
          color: highlightColor,
        });
      }
    }

    return map;
  }, [
    persistentHighlights,
    selectedVerseKey,
    selectedPageNumber,
    pageNumber,
    highlightColor,
  ]);

  if (!fontMgr || !justResults || justResultsPageRef.current !== pageNumber) {
    return <View style={styles.page} />;
  }

  return (
    <GestureDetector gesture={longPressGesture}>
      <View style={styles.page}>
        <Canvas
          style={{
            width: CONTENT_WIDTH,
            height: CONTENT_HEIGHT,
            marginLeft: PAGE_PADDING_HORIZONTAL,
            marginTop: PAGE_PADDING_TOP,
          }}>
          {pageLines.map((line, lineIndex) => {
            if (!justResults[lineIndex]) return null;
            if (line.line_type === 'surah_name') return null;

            const yPos = lineYPositions[lineIndex];

            const lineInfo = quranTextService.getLineInfo(
              pageNumber,
              lineIndex,
            );
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
                charToRule={lineTajweedMaps?.[lineIndex] ?? undefined}
                fontFamily={fontFamily}
                onParagraphReady={handleParagraphReady}
                highlights={lineHighlightsMap.get(lineIndex)}
              />
            );
          })}
        </Canvas>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});

export default React.memo(SkiaPage);
