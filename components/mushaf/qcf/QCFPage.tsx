// QCF V2 mushaf renderer.
//
// Per-line Skia paragraphs, each at its own y position from
// calculateLineYPositions(). TextAlign.Center, layout to CONTENT_WIDTH.
// KFGQPC glyph advances already encode per-line spacing — no Justify
// needed (Skia's Justify can't engage on PUA codepoints with no
// whitespace anyway).
//
// fontSize is calibrated per-page from the widest ayah line, matching
// the KFGQPC typographer's intent (each page-font is designed so its
// widest line fills the page width at the natural design size).
//
// Surah-name lines render via SkiaSurahHeader (same component DK uses
// at SkiaPage.tsx). Basmallah lines render exactly like DK does: the
// Unicode BASMALLAH_TEXT in the DigitalKhatt font with the OpenType
// `basm` feature. This matches DK's printed-mushaf basmallah look so
// surah-start pages look identical between DK and QCF modes.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View, StyleSheet, Platform} from 'react-native';
import {
  Canvas,
  Group,
  Paragraph,
  RoundedRect,
  Skia,
  TextAlign,
  TextDirection,
  TextHeightBehavior,
  type SkParagraph,
  type SkTextStyle,
} from '@shopify/react-native-skia';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import Color from 'color';
import {SheetManager} from 'react-native-actions-sheet';
import {
  digitalKhattDataService,
  BASMALLAH_TEXT,
  type DKLine,
} from '@/services/mushaf/DigitalKhattDataService';
import {qcfDataService} from '@/services/mushaf/QCFDataService';
import {
  buildQCFLineRenderModel,
  buildQCFLineAllahNameMap,
  findQCFVerseAtCharIndex,
  type QCFLineRenderModel,
} from '@/services/mushaf/QCFLineService';
import {PAGE_WIDTH, FONTSIZE} from '@/services/mushaf/QuranTextService';
import {
  qcfFontFamilyForPage,
  qcfFontLoader,
} from '@/services/mushaf/QCFFontLoader';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {getTextAllahNameCharMap} from '@/services/mushaf/AllahNameHighlightService';
import {themeDataService} from '@/services/mushaf/ThemeDataService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {
  createTextStrokePaint,
  getArabicTextWeightStrokeWidth,
} from '@/utils/skiaTextWeight';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import {useTheme} from '@/hooks/useTheme';
import SkiaSurahHeader from '../skia/SkiaSurahHeader';
import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  PAGE_PADDING_HORIZONTAL,
  PAGE_PADDING_TOP,
  CONTENT_WIDTH,
  CONTENT_HEIGHT,
  calculateLineYPositions,
} from '../constants';

interface QCFPageProps {
  pageNumber: number;
  textColor: string;
  dividerColor: string;
  contentMarginLeft?: number;
  onReady?: () => void;
  onTap?: () => void;
}

const lineParStyle = {
  textDirection: TextDirection.RTL,
  textAlign: TextAlign.Center,
  textHeightBehavior: TextHeightBehavior.DisableAll,
};

const REF_FONT_SIZE = 100;
const FILL_RATIO = 0.97;

// DK's font + size for basmallah rendering. Matches SkiaPage's calc
// (FONTSIZE * scale * 0.9 where scale = CONTENT_WIDTH / PAGE_WIDTH).
const DK_FONT_FAMILY = 'DigitalKhattV2';
const DK_FONT_SIZE = (CONTENT_WIDTH / PAGE_WIDTH) * FONTSIZE * 0.9;

// Skia treats U+0020 (regular space) as a wrap-point and merges adjacent
// PUA word-glyphs at line start when no separator precedes them — the two
// failure modes are (a) first two words on every page rendering as one
// glyph blob and (b) hizb-marker pages where the QF API embeds a regular
// space inside the first word's code field. Replacing spaces with U+200A
// (HAIR SPACE) avoids both: it's non-breaking, narrow, and Skia treats it
// as letter-spacing rather than a word break. The same trick is what
// qcf_quran (Flutter) uses; see m4hmoud-atef/qcf_quran lib/src/qcf_page.dart.
interface RenderEntry {
  key: string;
  lineIndex: number;
  paragraph: SkParagraph;
  strokeParagraph: SkParagraph | null;
  yPos: number;
  width: number;
  model: QCFLineRenderModel | null;
  backgroundHighlights: Array<{start: number; end: number; color: string}>;
}

interface SurahHeaderEntry {
  key: string;
  surahNumber: number;
  yPos: number;
  lineHeight: number;
}

const QCFPage: React.FC<QCFPageProps> = ({
  pageNumber,
  textColor,
  dividerColor,
  contentMarginLeft,
  onReady,
  onTap,
}) => {
  const {theme} = useTheme();
  const fontMgr = mushafPreloadService.fontMgr;
  const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
  const showThemes = useMushafSettingsStore(s => s.showThemes);
  const showAllahNameHighlight = useMushafSettingsStore(
    s => s.showAllahNameHighlight,
  );
  const allahNameHighlightColorSetting = useMushafSettingsStore(
    s => s.allahNameHighlightColor,
  );
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

  const surahHeaderFonts = useMemo(() => {
    const qcTypeface = mushafPreloadService.quranCommonTypeface;
    if (!qcTypeface) return {dividerFont: null, nameFontSize: 0};
    const refFont = Skia.Font(qcTypeface, 100);
    // Reference glyph U+E000 in QuranCommon. Using the explicit escape
    // (not the literal char) so editors / Edit tools can't strip the
    // invisible PUA character and silently break the calc.
    const ids = refFont.getGlyphIDs('');
    const widths = refFont.getGlyphWidths(ids);
    const measuredW = widths[0] || 1;
    const scaledSize = (CONTENT_WIDTH / measuredW) * 100;
    return {
      dividerFont: Skia.Font(qcTypeface, scaledSize),
      nameFontSize: scaledSize * 0.4,
    };
  }, []);
  const [fontReady, setFontReady] = useState<boolean>(() =>
    qcfFontLoader.isReady(pageNumber),
  );
  const [error, setError] = useState<string | null>(null);

  const pageLines = useMemo<DKLine[]>(
    () => digitalKhattDataService.getPageLines(pageNumber),
    [pageNumber],
  );

  const lineYPositions = useMemo(
    () => calculateLineYPositions(pageLines, pageNumber),
    [pageLines, pageNumber],
  );

  const orderedVerseKeys = useMemo(
    () => qcfDataService.getOrderedVerseKeysForPage(pageNumber),
    [pageNumber],
  );
  const orderedVerseKeysRef = useRef<string[]>(orderedVerseKeys);
  orderedVerseKeysRef.current = orderedVerseKeys;

  const dragStartVerseKeyRef = useRef<string | null>(null);
  const dragCurrentVerseKeyRef = useRef<string | null>(null);
  const allahNameHighlightColor = useMemo(
    () =>
      getAllahNameHighlightColorHex(
        allahNameHighlightColorSetting,
        theme.isDarkMode,
      ),
    [allahNameHighlightColorSetting, theme.isDarkMode],
  );

  const selectionBgColor = useMemo(
    () =>
      Color(textColor)
        .alpha(0.18)
        .toString(),
    [textColor],
  );

  const themeBgColor = useMemo(
    () =>
      Color(textColor)
        .alpha(0.12)
        .toString(),
    [textColor],
  );

  const lineBackgroundHighlights = useMemo(() => {
    const byLine = new Map<
      number,
      Array<{start: number; end: number; color: string}>
    >();
    const selectedSet =
      selectedPageNumber === pageNumber && selectedVerseKeys.length > 0
        ? new Set(selectedVerseKeys)
        : null;
    for (let i = 0; i < pageLines.length; i++) {
      const line = pageLines[i];
      if (line.line_type !== 'ayah') continue;
      const words = qcfDataService.getWordsForLine(pageNumber, line.line_number);
      if (words.length === 0) continue;
      const model = buildQCFLineRenderModel(words);
      const ranges: Array<{start: number; end: number; color: string}> = [];
      for (const segment of model.verseSegments) {
        if (showThemes && !selectedSet?.has(segment.verseKey)) {
          const themeInfo = themeDataService.getThemeForVerse(segment.verseKey);
          if (themeInfo && themeInfo.themeIndex % 2 === 0) {
            ranges.push({
              start: segment.startCharIndex,
              end: segment.endCharIndex,
              color: themeBgColor,
            });
          }
        }
        if (selectedSet?.has(segment.verseKey)) {
          ranges.push({
            start: segment.startCharIndex,
            end: segment.endCharIndex,
            color: selectionBgColor,
          });
        }
      }
      if (ranges.length > 0) {
        byLine.set(i, ranges);
      }
    }

    return byLine;
  }, [
    pageLines,
    pageNumber,
    selectedPageNumber,
    selectedVerseKeys,
    selectionBgColor,
    showThemes,
    themeBgColor,
  ]);

  // Load this page's QCF page-font, prefetch neighbors. Basmallah no
  // longer needs the page-1 font — DK font handles it.
  useEffect(() => {
    if (!fontMgr) return;
    let cancelled = false;
    setError(null);
    setFontReady(qcfFontLoader.isReady(pageNumber));

    (async () => {
      try {
        await qcfFontLoader.ensure(pageNumber, fontMgr);
        if (!cancelled) setFontReady(true);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'QCF font load failed');
        }
        return;
      }

      qcfFontLoader.prefetch(
        [pageNumber - 1, pageNumber + 1, pageNumber - 2, pageNumber + 2],
        fontMgr,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [fontMgr, pageNumber]);

  const renderEntries = useMemo<RenderEntry[]>(() => {
    if (!fontMgr || !fontReady) return [];

    const fontFamily = qcfFontFamilyForPage(pageNumber);

    // Measure every ayah line at REF_FONT_SIZE so we can pick fontSize and
    // also detect width outliers (one anomalously wide line that would
    // otherwise drag fontSize down for the whole page).
    const tmpBuilder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr);
    const lineWidths: number[] = [];
    for (const line of pageLines) {
      if (line.line_type !== 'ayah') continue;
      const words = qcfDataService.getWordsForLine(
        pageNumber,
        line.line_number,
      );
      if (words.length === 0) continue;
      const text = buildQCFLineRenderModel(words).renderedText;

      tmpBuilder.reset();
      tmpBuilder.pushStyle({
        color: Skia.Color(textColor),
        fontFamilies: [fontFamily],
        fontSize: REF_FONT_SIZE,
      });
      tmpBuilder.addText(text);
      const para = tmpBuilder.build();
      para.layout(99999);
      lineWidths.push(para.getLongestLine());
      para.dispose();
    }
    if (lineWidths.length === 0) return [];

    // Outlier-skip: if the widest line is >5% wider than the second-widest
    // (e.g., page 27's line 14, which the printed mushaf wraps to line 15),
    // calibrate against the second-widest. The outlier line then overhangs
    // the canvas slightly via per-line natural-width centering below — much
    // better than shrinking the entire page to fit one anomaly.
    const sortedDesc = [...lineWidths].sort((a, b) => b - a);
    const widestRef =
      sortedDesc.length > 1 && sortedDesc[0] > sortedDesc[1] * 1.05
        ? sortedDesc[1]
        : sortedDesc[0];

    const fontSize =
      ((CONTENT_WIDTH * FILL_RATIO) / widestRef) * REF_FONT_SIZE;

    // Lay out each line at its INTRINSIC width (not canvas width) so outlier
    // lines overhang the canvas edges instead of wrapping. We position the
    // line with an explicit x-offset for centering at render time.
    const buildOne = (
      text: string,
      family: string,
      charToColor?: Map<number, string> | null,
      options?: {
        fontSize?: number;
        fontFeatures?: Array<{name: string; value: number}>;
      },
    ): {
      paragraph: SkParagraph;
      strokeParagraph: SkParagraph | null;
      width: number;
    } => {
      const color = Skia.Color(textColor);
      const effectiveFontSize = options?.fontSize ?? fontSize;
      const strokeWidth = getArabicTextWeightStrokeWidth(
        arabicTextWeight,
        effectiveFontSize,
      );
      const baseStyle: SkTextStyle = {
        color,
        fontFamilies: [family],
        fontSize: effectiveFontSize,
      };
      if (options?.fontFeatures?.length) {
        baseStyle.fontFeatures = options.fontFeatures;
      }

      const buildParagraph = (withStroke: boolean) => {
        const builder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr);
        const pushStyle = (style: SkTextStyle, styleColor: string) => {
          const strokePaint = withStroke
            ? createTextStrokePaint(Skia.Color(styleColor), strokeWidth)
            : undefined;
          if (strokePaint) {
            builder.pushStyle(style, strokePaint);
          } else {
            builder.pushStyle(style);
          }
        };

        pushStyle(baseStyle, textColor);
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const colorOverride = charToColor?.get(i);
          if (colorOverride) {
            const charStyle: SkTextStyle = {
              ...baseStyle,
              color: Skia.Color(colorOverride),
            };
            pushStyle(charStyle, colorOverride);
            builder.addText(char);
            builder.pop();
          } else {
            builder.addText(char);
          }
        }
        builder.pop();
        const para = builder.build();
        para.layout(99999);
        const naturalWidth = para.getLongestLine();
        para.layout(Math.ceil(naturalWidth) + 2);
        return {paragraph: para, width: naturalWidth};
      };

      const base = buildParagraph(false);
      const stroke = strokeWidth > 0 ? buildParagraph(true).paragraph : null;
      return {
        paragraph: base.paragraph,
        strokeParagraph: stroke,
        width: base.width,
      };
    };

    const entries: RenderEntry[] = [];
    for (let i = 0; i < pageLines.length; i++) {
      const line = pageLines[i];
      const yPos = lineYPositions[i];

      if (line.line_type === 'surah_name') {
        // Rendered separately as a SkiaSurahHeader element; see the
        // surahHeaders memo below.
        continue;
      }

      if (line.line_type === 'basmallah') {
        const basmallahAllahMap =
          showAllahNameHighlight && allahNameHighlightColor
            ? new Map(
                [
                  ...(getTextAllahNameCharMap(BASMALLAH_TEXT)?.keys() ?? []),
                ].map(index => [index, allahNameHighlightColor] as const),
              )
            : null;
        const built = buildOne(BASMALLAH_TEXT, DK_FONT_FAMILY, basmallahAllahMap, {
          fontSize: DK_FONT_SIZE,
          fontFeatures: [{name: 'basm', value: 1}],
        });
        entries.push({
          key: `bs-${i}`,
          lineIndex: i,
          paragraph: built.paragraph,
          strokeParagraph: built.strokeParagraph,
          width: built.width,
          yPos,
          model: null,
          backgroundHighlights: [],
        });
        continue;
      }

      // ayah
      const words = qcfDataService.getWordsForLine(
        pageNumber,
        line.line_number,
      );
      if (words.length === 0) continue;
      const model = buildQCFLineRenderModel(words);
      const text = model.renderedText;
      const charToColor =
        showAllahNameHighlight && allahNameHighlightColor
          ? buildQCFLineAllahNameMap(words, allahNameHighlightColor)
          : null;
      const built = buildOne(text, fontFamily, charToColor);
      entries.push({
        key: `ay-${i}`,
        lineIndex: i,
        ...built,
        yPos,
        model,
        backgroundHighlights: lineBackgroundHighlights.get(i) ?? [],
      });
    }
    return entries;
  }, [
    allahNameHighlightColor,
    arabicTextWeight,
    fontMgr,
    fontReady,
    lineBackgroundHighlights,
    pageLines,
    lineYPositions,
    pageNumber,
    showAllahNameHighlight,
    textColor,
  ]);

  // Surah-header lines (line_type === 'surah_name'). DK's SkiaSurahHeader
  // takes the same dividerFont + nameFontSize we computed above, plus the
  // surah number from DK's pageLines metadata.
  const surahHeaders = useMemo<SurahHeaderEntry[]>(() => {
    const entries: SurahHeaderEntry[] = [];
    for (let i = 0; i < pageLines.length; i++) {
      const line = pageLines[i];
      if (line.line_type !== 'surah_name') continue;
      const yPos = lineYPositions[i];
      const lineHeight =
        i < lineYPositions.length - 1
          ? lineYPositions[i + 1] - lineYPositions[i]
          : CONTENT_HEIGHT - lineYPositions[i];
      entries.push({
        key: `sh-${i}`,
        surahNumber: line.surah_number,
        yPos,
        lineHeight,
      });
    }
    return entries;
  }, [pageLines, lineYPositions]);

  useEffect(() => {
    if (error) {
      onReady?.();
      return;
    }
    if (renderEntries.length > 0) onReady?.();
  }, [renderEntries.length, error, onReady]);

  const handleTap = useCallback(() => {
    onTap?.();
  }, [onTap]);

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';
        runOnJS(handleTap)();
      }),
    [handleTap],
  );

  const renderEntryByLine = useMemo(() => {
    const map = new Map<number, RenderEntry>();
    for (const entry of renderEntries) {
      map.set(entry.lineIndex, entry);
    }
    return map;
  }, [renderEntries]);

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

      const entry = renderEntryByLine.get(lineIndex);
      if (!entry?.model) return null;

      const paragraphX = canvasX - (CONTENT_WIDTH - entry.width) / 2;
      const paragraphY = canvasY - entry.yPos;
      const charIndex = entry.paragraph.getGlyphPositionAtCoordinate(
        paragraphX,
        paragraphY,
      );

      return findQCFVerseAtCharIndex(entry.model, charIndex);
    },
    [contentMarginLeft, findLineAtY, renderEntryByLine],
  );

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
    [hitTestVerse, pageNumber, selectVerse],
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
    [hitTestVerse, pageNumber, selectVerse, selectVerseRange],
  );

  const handleDragEnd = useCallback(() => {
    const startKey = dragStartVerseKeyRef.current;
    if (!startKey) return;

    const store = useMushafVerseSelectionStore.getState();
    const keys = store.selectedVerseKeys;
    if (keys.length === 0) return;

    const firstKey = keys[0];
    const [surahStr, ayahStr] = firstKey.split(':');
    SheetManager.show('verse-actions', {
      payload: {
        verseKey: firstKey,
        surahNumber: parseInt(surahStr, 10),
        ayahNumber: parseInt(ayahStr, 10),
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
    [handleDragEnd, handleDragStart, handleDragUpdate],
  );

  const composedGesture = useMemo(
    () => Gesture.Exclusive(longPressDragGesture, tapGesture),
    [longPressDragGesture, tapGesture],
  );

  if (!fontMgr || pageLines.length === 0) {
    return <View style={styles.page} />;
  }

  if (!fontReady || renderEntries.length === 0) {
    return (
      <GestureDetector gesture={composedGesture}>
        <View style={styles.page} />
      </GestureDetector>
    );
  }

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={styles.page}>
        <Canvas
          style={{
            width: CONTENT_WIDTH,
            height: CONTENT_HEIGHT,
            marginLeft: contentMarginLeft ?? PAGE_PADDING_HORIZONTAL,
            marginTop: PAGE_PADDING_TOP,
          }}>
          {surahHeaderFonts.dividerFont &&
            surahHeaders.map(({key, surahNumber, yPos, lineHeight}) => (
              <SkiaSurahHeader
                key={key}
                dividerFont={surahHeaderFonts.dividerFont!}
                fontMgr={fontMgr}
                nameFontSize={surahHeaderFonts.nameFontSize}
                surahNumber={surahNumber}
                yPos={yPos}
                pageWidth={CONTENT_WIDTH}
                dividerColor={dividerColor}
                nameColor={textColor}
                lineHeight={lineHeight}
              />
            ))}
          {renderEntries.map(
            ({key, paragraph, strokeParagraph, yPos, width, backgroundHighlights}) => (
            <Group key={key}>
              {backgroundHighlights.map((highlight, index) => {
                const rects = paragraph.getRectsForRange(
                  highlight.start,
                  highlight.end + 1,
                );
                return rects.map((rect, rectIndex) => (
                  <RoundedRect
                    key={`${key}-bg-${index}-${rectIndex}`}
                    x={(CONTENT_WIDTH - width) / 2 + rect.x}
                    y={yPos + rect.y}
                    width={rect.width}
                    height={rect.height}
                    r={4}
                    color={highlight.color}
                  />
                ));
              })}
              {strokeParagraph && (
                <Paragraph
                  paragraph={strokeParagraph}
                  x={(CONTENT_WIDTH - width) / 2}
                  y={yPos}
                  width={Math.ceil(width) + 2}
                />
              )}
              <Paragraph
                paragraph={paragraph}
                x={(CONTENT_WIDTH - width) / 2}
                y={yPos}
                width={Math.ceil(width) + 2}
              />
            </Group>
          ))}
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

export default QCFPage;
