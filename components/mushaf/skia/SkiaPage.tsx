import React, {useMemo, useState, useEffect, useRef, useCallback} from 'react';
import {View, StyleSheet, Platform} from 'react-native';
import {
  Canvas,
  Skia,
  useFonts,
  type SkParagraph,
} from '@shopify/react-native-skia';
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
import {mushafLayoutCacheService} from '@/services/mushaf/MushafLayoutCacheService';
import {getLineTajweedMap} from '@/services/mushaf/TajweedMappingService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {themeDataService} from '@/services/mushaf/ThemeDataService';
import {useTajweedStore} from '@/store/tajweedStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {useTheme} from '@/hooks/useTheme';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {HIGHLIGHT_COLORS} from '@/types/verse-annotations';
import Color from 'color';
import SkiaLine from './SkiaLine';
import SkiaSurahHeader from './SkiaSurahHeader';
import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  PAGE_PADDING_HORIZONTAL,
  PAGE_PADDING_TOP,
  CONTENT_WIDTH,
  CONTENT_HEIGHT,
  BASE_LINE_HEIGHT,
  calculateLineYPositions,
} from '../constants';

interface ParagraphInfo {
  paragraph: SkParagraph;
  xPos: number;
}

interface SkiaPageProps {
  pageNumber: number;
  textColor: string;
  dividerColor: string;
  contentMarginLeft?: number;
  onReady?: () => void;
  onTap?: () => void;
}

const SkiaPage: React.FC<SkiaPageProps> = ({
  pageNumber,
  textColor,
  dividerColor,
  contentMarginLeft,
  onReady,
  onTap,
}) => {
  const {theme} = useTheme();
  // Keep useFonts hook as fallback (can't conditionally call hooks).
  // Prefer preloaded fontMgr from MushafPreloadService — ready synchronously
  // on first render since AppInitializer runs before Mushaf tab mounts.
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

  // Calculate rendering dimensions (hoisted above surahHeaderFonts so lineWidth is available)
  const scale = CONTENT_WIDTH / PAGE_WIDTH;
  const margin = MARGIN * scale;
  const lineWidth = CONTENT_WIDTH - 2 * margin;

  // Create scaled SkFont objects for surah header rendering (Skia Text path)
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
  }, [lineWidth]);

  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const showThemes = useMushafSettingsStore(s => s.showThemes);
  const uthmaniFont = useMushafSettingsStore(s => s.uthmaniFont);
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);
  const fontFamily =
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : uthmaniFont === 'v1'
        ? 'DigitalKhattV1'
        : 'DigitalKhattV2';

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

  // Mushaf playback highlighting: only subscribe when verse is on this page
  const {isDarkMode} = useTheme();
  const playbackVerseKey = useMushafPlayerStore(s => {
    if (!s.currentVerseKey || s.playbackState === 'idle') return null;
    return s.currentVerseKey;
  });

  // Paragraph references for hit testing
  const paragraphMapRef = useRef<Map<number, ParagraphInfo>>(new Map());

  // onReady tracking — refs keep handleParagraphReady callback stable
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const readyFiredRef = useRef(false);

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

    // On-demand compute (first view of this page with this font)
    const result = JustService.getPageLayout(
      pageNumber,
      fontSizeLineWidthRatio,
      fontMgr,
      fontFamily,
    );
    setJustResults(result);

    // Persist to MMKV so the layout survives app restarts
    if (result.length > 0) {
      mushafLayoutCacheService.setPageLayout(pageNumber, fontFamily, result);
    }
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

      return mushafVerseMapService.findVerseAtCharIndex(
        pageNumber,
        lineIndex,
        charIndex,
      );
    },
    [pageNumber, pageLines, lineYPositions, findLineAtY, contentMarginLeft],
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

  // Drag update: extend selection range (disabled on Android to avoid gesture conflicts)
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
        source: 'mushaf',
      },
    });

    dragStartVerseKeyRef.current = null;
    dragCurrentVerseKeyRef.current = null;
  }, []);

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
    const hasAnnotations = Object.keys(persistentHighlights).length > 0;
    const hasPlayback = !!playbackVerseKey;
    const selectedSet =
      selectedVerseKeys.length > 0 && selectedPageNumber === pageNumber
        ? new Set(selectedVerseKeys)
        : null;

    if (!hasAnnotations && !hasPlayback && !selectedSet && !showThemes)
      return EMPTY_BG_MAP;

    const map = new Map<
      number,
      Array<{start: number; end: number; color: string}>
    >();

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

    // Layer 0: Theme zebra highlights (lowest priority)
    if (showThemes) {
      const themeColor = Color(textColor).alpha(0.12).toString();
      const pageVerseKeys =
        mushafVerseMapService.getOrderedVerseKeysForPage(pageNumber);
      for (const vk of pageVerseKeys) {
        // Skip verses that will be painted by a higher layer
        if (persistentHighlights[vk]) continue;
        if (playbackVerseKey === vk) continue;
        if (selectedSet?.has(vk)) continue;

        const themeInfo = themeDataService.getThemeForVerse(vk);
        if (!themeInfo) continue;

        // Only paint even-indexed themes; odd themes stay transparent (zebra)
        if (themeInfo.themeIndex % 2 !== 0) continue;

        addVerseHighlight(vk, themeColor);
      }
    }

    // Layer 1: Persistent annotation highlights (lowest priority)
    for (const [verseKey, colorName] of Object.entries(persistentHighlights)) {
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
    EMPTY_BG_MAP,
    showThemes,
    textColor,
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
              charToRule={lineTajweedMaps?.[lineIndex] ?? undefined}
              fontFamily={fontFamily}
              onParagraphReady={handleParagraphReady}
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

const styles = StyleSheet.create({
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});

export default React.memo(SkiaPage);
