import React, {useMemo, useState, useEffect, useRef, useCallback} from 'react';
import {Platform, View, StyleSheet} from 'react-native';
import {Canvas, useFonts, type SkParagraph} from '@shopify/react-native-skia';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-worklets';
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
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
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

interface ParagraphInfo {
  paragraph: SkParagraph;
  xPos: number;
}

interface SkiaPageProps {
  pageNumber: number;
  textColor: string;
  highlightColor: string;
  onReady?: () => void;
}

const SkiaPage: React.FC<SkiaPageProps> = ({
  pageNumber,
  textColor,
  highlightColor,
  onReady,
}) => {
  // Keep useFonts hook as fallback (can't conditionally call hooks).
  // Prefer preloaded fontMgr from MushafPreloadService — ready synchronously
  // on first render since AppInitializer runs before Mushaf tab mounts.
  const hookFontMgr = useFonts({
    DigitalKhattV1: [require('@/data/mushaf/legacy/DigitalKhattQuranicV1.otf')],
    DigitalKhattV2: [require('@/data/mushaf/digitalkhatt/DigitalKhattV2.otf')],
  });
  const fontMgr = mushafPreloadService.fontMgr || hookFontMgr;

  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const uthmaniFont = useMushafSettingsStore(s => s.uthmaniFont);
  const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);
  const fontFamily = uthmaniFont === 'v1' ? 'DigitalKhattV1' : 'DigitalKhattV2';

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

  const persistentHighlights = useVerseAnnotationsStore(s => s.highlights);

  // Paragraph references for hit testing
  const paragraphMapRef = useRef<Map<number, ParagraphInfo>>(new Map());

  // onReady tracking — refs keep handleParagraphReady callback stable
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const readyFiredRef = useRef(false);

  // Calculate rendering dimensions
  const scale = CONTENT_WIDTH / PAGE_WIDTH;
  const margin = MARGIN * scale;
  const lineWidth = CONTENT_WIDTH - 2 * margin;
  const fontSize = FONTSIZE * scale * 0.9;
  const fontSizeLineWidthRatio = fontSize / lineWidth;

  // Initialize from synchronous cache (in-memory → MMKV, both sync)
  const [justResults, setJustResults] = useState<JustResultByLine[] | null>(
    () =>
      JustService.getCachedPageLayout(
        fontSizeLineWidthRatio,
        pageNumber,
        fontFamily,
      ) ?? null,
  );

  // Get page lines for layout calculation
  const pageLines = useMemo<DKLine[]>(
    () => digitalKhattDataService.getPageLines(pageNumber),
    [pageNumber],
  );

  // Compute layout if not already cached (first-launch race condition fallback)
  useEffect(() => {
    if (!fontMgr) return;

    const cached = JustService.getCachedPageLayout(
      fontSizeLineWidthRatio,
      pageNumber,
      fontFamily,
    );
    if (cached) {
      setJustResults(cached);
      return;
    }

    // On-demand compute (only on first launch before MMKV is populated)
    const result = JustService.getPageLayout(
      pageNumber,
      fontSizeLineWidthRatio,
      fontMgr,
      fontFamily,
    );
    setJustResults(result);
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

  // Count lines that will render SkiaLine children (non-surah-name with justResults)
  const expectedLineCount = useMemo(() => {
    if (!justResults) return 0;
    let count = 0;
    for (let i = 0; i < pageLines.length; i++) {
      if (justResults[i] && pageLines[i].line_type !== 'surah_name') {
        count++;
      }
    }
    return count;
  }, [justResults, pageLines]);

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

  // Ordered verse keys for drag range computation
  const orderedVerseKeys = useMemo(
    () => mushafVerseMapService.getOrderedVerseKeysForPage(pageNumber),
    [pageNumber],
  );

  // Refs for drag state (avoid re-renders during drag)
  const dragStartVerseKeyRef = useRef<string | null>(null);
  const dragCurrentVerseKeyRef = useRef<string | null>(null);
  const orderedVerseKeysRef = useRef<string[]>(orderedVerseKeys);
  orderedVerseKeysRef.current = orderedVerseKeys;

  // Hit-test to find verse at a given touch coordinate
  const hitTestVerse = useCallback(
    (eventX: number, eventY: number) => {
      const canvasX = eventX - PAGE_PADDING_HORIZONTAL;
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

      return mushafVerseMapService.findVerseAtCharIndex(
        pageNumber,
        lineIndex,
        charIndex,
      );
    },
    [pageNumber, pageLines, lineYPositions, findLineAtY],
  );

  // Drag start: initial verse selection
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

  // Drag update: extend selection range
  const handleDragUpdate = useCallback(
    (eventX: number, eventY: number) => {
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

      // Only allow forward (downward) selection
      if (currentIdx < startIdx) {
        // Finger moved above start verse — keep only start
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

  // Drag end: open action sheet
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
      },
    });

    dragStartVerseKeyRef.current = null;
    dragCurrentVerseKeyRef.current = null;
  }, []);

  const longPressDragGesture = useMemo(
    () =>
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

  // Compute per-line highlight arrays merging persistent annotations + temporary selection
  const lineHighlightsMap = useMemo<
    Map<number, Array<{start: number; end: number; color: string}>>
  >(() => {
    const map = new Map<
      number,
      Array<{start: number; end: number; color: string}>
    >();

    // Build set of selected verse keys for fast lookup
    const selectedSet =
      selectedVerseKeys.length > 0 && selectedPageNumber === pageNumber
        ? new Set(selectedVerseKeys)
        : null;

    // Persistent annotation highlights (skip verses that are actively selected)
    for (const [verseKey, colorName] of Object.entries(persistentHighlights)) {
      if (selectedSet?.has(verseKey)) continue;
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
    if (selectedVerseKeys.length > 0 && selectedPageNumber === pageNumber) {
      for (const vk of selectedVerseKeys) {
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
            color: highlightColor,
          });
        }
      }
    }

    return map;
  }, [
    persistentHighlights,
    selectedVerseKeys,
    selectedPageNumber,
    pageNumber,
    highlightColor,
  ]);

  if (!fontMgr || !justResults) {
    return <View style={styles.page} />;
  }

  const content = (
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
              charToRule={lineTajweedMaps?.[lineIndex] ?? undefined}
              fontFamily={fontFamily}
              onParagraphReady={handleParagraphReady}
              highlights={lineHighlightsMap.get(lineIndex)}
            />
          );
        })}
      </Canvas>
    </View>
  );

  return Platform.OS === 'ios' ? (
    <GestureDetector gesture={longPressDragGesture}>{content}</GestureDetector>
  ) : (
    content
  );
};

const styles = StyleSheet.create({
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});

export default React.memo(SkiaPage);
