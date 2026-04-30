import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import {moderateScale, verticalScale} from '@/utils/scale';
import {
  Canvas,
  Paragraph,
  Skia,
  TextHeightBehavior,
  TextDirection,
  type SkTypefaceFontProvider,
  type SkTextStyle,
  type SkColor,
} from '@shopify/react-native-skia';
import Color from 'color';
import {
  digitalKhattDataService,
  type DKWordInfo,
} from '@/services/mushaf/DigitalKhattDataService';
import {wbwDataService, type WBWWord} from '@/services/wbw/WBWDataService';
import {useTheme} from '@/hooks/useTheme';
import {mediumHaptics} from '@/utils/haptics';
import {
  alignWordTajweed,
  detectWordTafkhim,
} from '@/services/mushaf/TajweedAlignmentService';
import {wordContainsAllahName} from '@/services/mushaf/AllahNameHighlightService';
import {tajweedColors} from '@/constants/tajweedColors';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import type {
  MushafArabicTextWeight,
  RewayahId,
} from '@/store/mushafSettingsStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  createTextStrokePaint,
  getArabicTextWeightStrokeWidth,
} from '@/utils/skiaTextWeight';

// --- Constants ---

const skParagraphStyle = {
  textHeightBehavior: TextHeightBehavior.DisableAll,
  textDirection: TextDirection.RTL,
};

const GAP = moderateScale(16);
const DIVIDER_MARGIN = verticalScale(4);
const DIVIDER_TOTAL_H = DIVIDER_MARGIN * 2 + StyleSheet.hairlineWidth;
const TRANSLIT_LINE_H = moderateScale(14);
const TRANS_LINE_H = moderateScale(14);
const PADDING_VERTICAL = verticalScale(8);
const TRANS_FONT_SIZE = moderateScale(11);
const TRANSLIT_FONT_SIZE = moderateScale(10.5);
const MIN_COL_WIDTH = moderateScale(36);
const HIGHLIGHT_PADDING = moderateScale(4);
const HIGHLIGHT_RADIUS = moderateScale(6);
// Metal GPU textures are limited to 8192 physical pixels.
// Divide by device pixel ratio to get safe logical-point limit.
const MAX_CANVAS_HEIGHT = Math.floor(8192 / PixelRatio.get()) - 100;

// --- Types ---

interface WBWVerseViewProps {
  verseKey: string;
  textColor: string;
  arabicFontSize: number;
  dkFontFamily: string;
  fontMgr: SkTypefaceFontProvider | null;
  showTranslation: boolean;
  showTransliteration: boolean;
  onWordPress: (position: number) => void;
  selectedWordPosition: number | null;
  showTajweed: boolean;
  indexedTajweedData: IndexedTajweedData | null;
  arabicTextWeight?: MushafArabicTextWeight;
  showAllahNameHighlight?: boolean;
  allahNameHighlightColor?: string;
  onTap?: () => void;
  onLongPress?: () => void;
  /** Context rewayah (player track or mushaf setting). Word-by-word data
   *  is Hafs-only, so the Arabic here is always rendered in Hafs — this
   *  prop only drives the "Showing Hafs" disclosure label. */
  rewayah?: RewayahId;
}

interface MatchedWord {
  dkWord: DKWordInfo;
  wbwWord: WBWWord;
}

interface PositionedWord {
  paragraph: ReturnType<ReturnType<typeof Skia.ParagraphBuilder.Make>['build']>;
  strokeParagraph: ReturnType<
    ReturnType<typeof Skia.ParagraphBuilder.Make>['build']
  > | null;
  arabicWidth: number;
  arabicHeight: number;
  columnWidth: number;
  x: number;
  y: number;
  totalItemHeight: number;
  /** DK word position — always unique, used as React key */
  dkPosition: number;
  /** WBW word position — used for tap lookup in WordDetailSheet */
  position: number;
  translation: string;
  transliteration: string;
  isEndMarker: boolean;
}

interface ComputedLayout {
  items: PositionedWord[];
  totalHeight: number;
}

// --- Helpers ---

/** Strip Arabic diacritics for fuzzy text comparison between DK and WBW words */
const ARABIC_DIACRITICS =
  // eslint-disable-next-line no-misleading-character-class
  /[\u064B-\u065F\u0670\u06D6-\u06ED\u0617-\u061A\u08D3-\u08FF\u0640\u06E5\u06E6\u0653-\u0655\u065F\uFE70-\uFE7F\u0610-\u0615\u0656-\u065E\u0660-\u066F]/g;

function stripDiacritics(text: string): string {
  return text.replace(ARABIC_DIACRITICS, '').trim();
}

function buildParagraph(
  text: string,
  fontMgr: SkTypefaceFontProvider,
  fontFamily: string,
  fontSize: number,
  textColor: string,
  charToRule?: Map<number, string> | null,
  arabicTextWeight: MushafArabicTextWeight = 'normal',
  allahNameHighlightColor?: string,
) {
  const baseColor = Skia.Color(allahNameHighlightColor || textColor);
  const strokeWidth = getArabicTextWeightStrokeWidth(
    arabicTextWeight,
    fontSize,
  );
  const baseStyle = {
    color: baseColor,
    fontFamilies: [fontFamily],
    fontSize,
  };

  const build = (withStroke: boolean) => {
    const builder = Skia.ParagraphBuilder.Make(skParagraphStyle, fontMgr);

    const pushStyle = (style: SkTextStyle, styleColor: SkColor) => {
      const strokePaint = withStroke
        ? createTextStrokePaint(styleColor, strokeWidth)
        : undefined;
      if (strokePaint) {
        builder.pushStyle(style, strokePaint);
      } else {
        builder.pushStyle(style);
      }
    };

    pushStyle(baseStyle, baseColor);

    if (allahNameHighlightColor || (charToRule && charToRule.size > 0)) {
      // Per-character tajweed coloring, with Allah-name override taking priority.
      for (let i = 0; i < text.length; i++) {
        const rule = charToRule?.get(i);
        const resolvedColor =
          allahNameHighlightColor ||
          (rule && tajweedColors[rule] ? tajweedColors[rule] : null);
        if (resolvedColor) {
          const charColor = Skia.Color(resolvedColor);
          pushStyle(
            {
              ...baseStyle,
              color: charColor,
            },
            charColor,
          );
          builder.addText(text.charAt(i));
          builder.pop();
        } else {
          builder.addText(text.charAt(i));
        }
      }
    } else {
      builder.addText(text);
    }

    builder.pop();
    const p = builder.build();
    p.layout(1000); // Large width, single word never wraps
    return p;
  };

  const p = build(false);
  const strokeP = strokeWidth > 0 ? build(true) : null;
  return {
    paragraph: p,
    strokeParagraph: strokeP,
    width: Math.ceil(p.getLongestLine()) + 1,
    height: p.getHeight(),
  };
}

const skLTRParagraphStyle = {
  textHeightBehavior: TextHeightBehavior.DisableAll,
  textDirection: TextDirection.LTR,
};

function measureTextWidth(
  text: string,
  fontMgr: SkTypefaceFontProvider,
  fontSize: number,
): number {
  const builder = Skia.ParagraphBuilder.Make(skLTRParagraphStyle, fontMgr);
  builder.pushStyle({
    fontFamilies: ['ManropeRegular'],
    fontSize,
  });
  builder.addText(text);
  builder.pop();
  const p = builder.build();
  p.layout(10000);
  return Math.ceil(p.getLongestLine()) + 1;
}

function computeColumnWidth(
  arabicWidth: number,
  translation: string,
  transliteration: string,
  showTranslation: boolean,
  showTransliteration: boolean,
  fontMgr: SkTypefaceFontProvider,
): number {
  let maxWidth = arabicWidth;
  if (showTranslation && translation) {
    maxWidth = Math.max(
      maxWidth,
      measureTextWidth(translation, fontMgr, TRANS_FONT_SIZE),
    );
  }
  if (showTransliteration && transliteration) {
    maxWidth = Math.max(
      maxWidth,
      measureTextWidth(transliteration, fontMgr, TRANSLIT_FONT_SIZE),
    );
  }
  // Add small buffer to account for Skia↔RN text measurement differences
  return Math.max(maxWidth + 2, MIN_COL_WIDTH);
}

function computeRTLLayout(
  items: Array<{
    paragraph: ReturnType<
      ReturnType<typeof Skia.ParagraphBuilder.Make>['build']
    >;
    strokeParagraph: ReturnType<
      ReturnType<typeof Skia.ParagraphBuilder.Make>['build']
    > | null;
    arabicWidth: number;
    arabicHeight: number;
    columnWidth: number;
    dkPosition: number;
    position: number;
    translation: string;
    transliteration: string;
    isEndMarker: boolean;
  }>,
  containerWidth: number,
  subTextHeight: number,
): ComputedLayout {
  const positioned: PositionedWord[] = [];
  let cursorX = containerWidth;
  let cursorY = 0;
  let rowMaxHeight = 0;

  for (const item of items) {
    const colWidth = item.columnWidth;
    const itemH = item.arabicHeight + (item.isEndMarker ? 0 : subTextHeight);

    // Wrap to next row if doesn't fit (unless it's the first item in a row)
    if (cursorX - colWidth < 0 && cursorX < containerWidth) {
      cursorY += rowMaxHeight + GAP;
      cursorX = containerWidth;
      rowMaxHeight = 0;
    }

    cursorX -= colWidth;

    positioned.push({
      ...item,
      x: cursorX,
      y: cursorY,
      totalItemHeight: itemH,
    });

    rowMaxHeight = Math.max(rowMaxHeight, itemH);
    cursorX -= GAP;
  }

  return {
    items: positioned,
    totalHeight: cursorY + rowMaxHeight,
  };
}

// --- Main component ---

export const WBWVerseView = memo<WBWVerseViewProps>(
  ({
    verseKey,
    textColor,
    arabicFontSize,
    dkFontFamily,
    fontMgr,
    showTranslation,
    showTransliteration,
    onWordPress,
    selectedWordPosition,
    showTajweed,
    indexedTajweedData,
    arabicTextWeight = 'normal',
    showAllahNameHighlight = false,
    allahNameHighlightColor,
    onTap,
    onLongPress,
    rewayah: rewayahProp,
  }) => {
    const {theme} = useTheme();
    const [containerWidth, setContainerWidth] = useState(0);
    const activeRewayah = useMushafSettingsStore(s => s.rewayah);
    const contextRewayah = rewayahProp ?? activeRewayah;
    const showingHafsFallback = contextRewayah !== 'hafs';

    // Word-by-word data is Hafs-aligned — always fetch Hafs DK words so
    // word boundaries match the translation/transliteration payload.
    // Lazy-load Hafs into the side cache if the mushaf is currently on a
    // non-Hafs rewayah, then re-render.
    const [, bumpHafsLoaded] = React.useReducer(x => x + 1, 0);
    useEffect(() => {
      if (digitalKhattDataService.rewayah === 'hafs') return;
      let cancelled = false;
      digitalKhattDataService.ensureRewayahLoaded('hafs').then(() => {
        if (!cancelled) bumpHafsLoaded();
      });
      return () => {
        cancelled = true;
      };
    }, []);

    // Try sync cache first, fall back to async
    const cachedWords = useMemo(
      () => wbwDataService.getVerseWordsCached(verseKey),
      [verseKey],
    );
    const [asyncWords, setAsyncWords] = useState<WBWWord[] | null>(null);

    useEffect(() => {
      if (cachedWords) return; // Already have data synchronously
      let cancelled = false;
      setAsyncWords(null);
      wbwDataService.getVerseWords(verseKey).then(words => {
        if (!cancelled) setAsyncWords(words);
      });
      return () => {
        cancelled = true;
      };
    }, [verseKey, cachedWords]);

    const wbwWords = cachedWords ?? asyncWords;

    // Always read Hafs DK words — WBW word indexing is Hafs-aligned.
    const dkWords = useMemo(
      () => digitalKhattDataService.getVerseWords(verseKey, 'hafs'),
      [verseKey],
    );

    // Match DK words with WBW words using text-aware sequential alignment.
    // DK sometimes splits compound words (e.g. "بَعْدَ مَا") into two tokens
    // while Quran.com keeps them as one, so position-based matching would
    // misalign all subsequent words. This handles both 1:1 and N:1 cases.
    const {matchedWords, verseEndMarker} = useMemo(() => {
      if (!wbwWords || wbwWords.length === 0)
        return {
          matchedWords: [] as MatchedWord[],
          verseEndMarker: null as DKWordInfo | null,
        };

      const result: MatchedWord[] = [];
      let endMarker: DKWordInfo | null = null;
      let wbwIdx = 0;
      let accumulated = '';

      for (let dkIdx = 0; dkIdx < dkWords.length; dkIdx++) {
        const dkWord = dkWords[dkIdx];

        if (wbwIdx >= wbwWords.length) {
          endMarker = dkWord;
          continue;
        }

        const wbwWord = wbwWords[wbwIdx];
        const dkNorm = stripDiacritics(dkWord.text);
        const wbwNorm = stripDiacritics(wbwWord.textUthmani);

        // Build accumulated DK text for current WBW word
        accumulated = accumulated ? accumulated + ' ' + dkNorm : dkNorm;

        if (accumulated === wbwNorm || !wbwNorm) {
          // Exact match (1:1 or end of N:1 merge) — pair and advance WBW
          result.push({dkWord, wbwWord});
          wbwIdx++;
          accumulated = '';
        } else if (wbwNorm.startsWith(accumulated + ' ')) {
          // DK word is a prefix of the WBW word — pair but don't advance WBW
          // (the next DK word will continue accumulating into the same WBW word)
          result.push({dkWord, wbwWord});
        } else {
          // No text match — fallback to direct pairing and advance
          result.push({dkWord, wbwWord});
          wbwIdx++;
          accumulated = '';
        }
      }

      return {matchedWords: result, verseEndMarker: endMarker};
    }, [dkWords, wbwWords]);

    // Derive colors once
    const derivedColors = useMemo(
      () => ({
        divider: Color(theme.colors.text).alpha(0.06).toString(),
        transliteration: Color(theme.colors.textSecondary)
          .alpha(0.5)
          .toString(),
        translation: Color(theme.colors.text).alpha(0.7).toString(),
      }),
      [theme.colors.text, theme.colors.textSecondary],
    );

    const handleLayout = useCallback((e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      setContainerWidth(prev => (Math.abs(prev - w) > 1 ? w : prev));
    }, []);

    // Tajweed word data for this verse (null when tajweed is off)
    const tajweedWords = useMemo(
      () =>
        showTajweed && indexedTajweedData
          ? (indexedTajweedData[verseKey] ?? null)
          : null,
      [showTajweed, indexedTajweedData, verseKey],
    );

    // Build all Skia paragraphs + compute RTL layout in one pass
    const computedLayout = useMemo<ComputedLayout | null>(() => {
      if (!fontMgr || containerWidth <= 0 || matchedWords.length === 0)
        return null;

      const scaledFontSize = moderateScale(arabicFontSize);
      const subTextH =
        DIVIDER_TOTAL_H +
        (showTransliteration ? TRANSLIT_LINE_H : 0) +
        (showTranslation ? TRANS_LINE_H : 0);

      const items = matchedWords.map(({dkWord, wbwWord}) => {
        // Compute per-character tajweed rules for this word
        let wordCharToRule: Map<number, string> | null = null;
        if (tajweedWords) {
          const tajweedWord = tajweedWords.find(w => {
            const pos = parseInt(w.location.split(':')[2], 10);
            return pos === dkWord.wordPositionInVerse;
          });
          wordCharToRule = tajweedWord
            ? alignWordTajweed(dkWord.text, tajweedWord.segments)
            : detectWordTafkhim(dkWord.text);
        }

        const wordAllahHighlightColor =
          showAllahNameHighlight &&
          allahNameHighlightColor &&
          wordContainsAllahName(dkWord.text)
            ? allahNameHighlightColor
            : undefined;

        const {paragraph, strokeParagraph, width, height} = buildParagraph(
          dkWord.text,
          fontMgr,
          dkFontFamily,
          scaledFontSize,
          textColor,
          wordCharToRule,
          arabicTextWeight,
          wordAllahHighlightColor,
        );
        return {
          paragraph,
          strokeParagraph,
          arabicWidth: width,
          arabicHeight: height,
          columnWidth: computeColumnWidth(
            width,
            wbwWord.translation,
            wbwWord.transliteration,
            showTranslation,
            showTransliteration,
            fontMgr,
          ),
          dkPosition: dkWord.wordPositionInVerse,
          position: wbwWord.position,
          translation: wbwWord.translation,
          transliteration: wbwWord.transliteration,
          isEndMarker: false,
        };
      });

      if (verseEndMarker) {
        const {paragraph, strokeParagraph, width, height} = buildParagraph(
          verseEndMarker.text,
          fontMgr,
          dkFontFamily,
          scaledFontSize,
          textColor,
          null,
          arabicTextWeight,
          undefined,
        );
        items.push({
          paragraph,
          strokeParagraph,
          arabicWidth: width,
          arabicHeight: height,
          columnWidth: width,
          dkPosition: verseEndMarker.wordPositionInVerse,
          position: -1,
          translation: '',
          transliteration: '',
          isEndMarker: true,
        });
      }

      return computeRTLLayout(items, containerWidth, subTextH);
    }, [
      fontMgr,
      containerWidth,
      matchedWords,
      verseEndMarker,
      arabicFontSize,
      dkFontFamily,
      textColor,
      showTranslation,
      showTransliteration,
      tajweedWords,
      arabicTextWeight,
      showAllahNameHighlight,
      allahNameHighlightColor,
    ]);

    // Highlight color for selected word
    const highlightColor = useMemo(
      () => Color(theme.colors.text).alpha(0.08).toString(),
      [theme.colors.text],
    );

    // Find layout items for the currently selected word (may be multiple DK
    // items when a compound word like "بَعْدَ مَا" maps to a single WBW word)
    const selectedItems = useMemo(() => {
      if (selectedWordPosition == null || !computedLayout) return [];
      return computedLayout.items.filter(
        item => !item.isEndMarker && item.position === selectedWordPosition,
      );
    }, [selectedWordPosition, computedLayout]);

    // Hit-test tap to find which word was pressed
    const handleWordPress = useCallback(
      (e: GestureResponderEvent) => {
        if (!computedLayout) return;
        const {locationX, locationY} = e.nativeEvent;
        // Adjust for padding
        const adjY = locationY - PADDING_VERTICAL;
        for (const item of computedLayout.items) {
          if (item.isEndMarker) continue;
          if (
            locationX >= item.x &&
            locationX <= item.x + item.columnWidth &&
            adjY >= item.y &&
            adjY <= item.y + item.totalItemHeight
          ) {
            mediumHaptics();
            onWordPress(item.position);
            return;
          }
        }
        // No word hit — forward to parent long-press handler
        onLongPress?.();
      },
      [computedLayout, onWordPress, onLongPress],
    );

    // Split layout items into canvas chunks that stay within Metal texture limits
    const canvasChunks = useMemo(() => {
      if (!computedLayout) return [];
      if (computedLayout.totalHeight <= MAX_CANVAS_HEIGHT) {
        return [
          {
            startY: 0,
            height: computedLayout.totalHeight,
            items: computedLayout.items,
          },
        ];
      }
      // Group items by row (same Y = same row)
      const rowYs = [...new Set(computedLayout.items.map(i => i.y))].sort(
        (a, b) => a - b,
      );
      const chunks: Array<{
        startY: number;
        height: number;
        items: PositionedWord[];
      }> = [];
      let chunkStartY = 0;
      let chunkItems: PositionedWord[] = [];
      for (const rowY of rowYs) {
        const rowItems = computedLayout.items.filter(i => i.y === rowY);
        const rowBottom = Math.max(
          ...rowItems.map(i => i.y + i.totalItemHeight),
        );
        if (
          rowBottom - chunkStartY > MAX_CANVAS_HEIGHT &&
          chunkItems.length > 0
        ) {
          const chunkEndY = Math.max(
            ...chunkItems.map(i => i.y + i.totalItemHeight),
          );
          chunks.push({
            startY: chunkStartY,
            height: chunkEndY - chunkStartY,
            items: chunkItems,
          });
          chunkStartY = rowY;
          chunkItems = [...rowItems];
        } else {
          chunkItems.push(...rowItems);
        }
      }
      if (chunkItems.length > 0) {
        const chunkEndY = Math.max(
          ...chunkItems.map(i => i.y + i.totalItemHeight),
        );
        chunks.push({
          startY: chunkStartY,
          height: chunkEndY - chunkStartY,
          items: chunkItems,
        });
      }
      return chunks;
    }, [computedLayout]);

    if (!wbwWords) return null;

    // Small disclosure when the active context rewayah isn't Hafs —
    // WBW data is Hafs-aligned, so the word grid here is always Hafs.
    const hafsNotice = showingHafsFallback ? (
      <Text
        style={[
          styles.hafsNotice,
          {color: Color(textColor).alpha(0.5).toString()},
        ]}>
        Word-by-word shown in Hafs
      </Text>
    ) : null;

    // Optimized single-canvas render when Skia is available and width is measured
    if (fontMgr && computedLayout) {
      return (
        <View>
          {hafsNotice}
          <Pressable
            onLayout={handleLayout}
            onPress={onTap}
            onLongPress={handleWordPress}
            style={[
              styles.singleCanvasContainer,
              {height: computedLayout.totalHeight + PADDING_VERTICAL * 2},
            ]}>
            {/* Word highlight boxes (rendered before Canvas so text sits on top) */}
            {selectedItems.map(item => (
              <View
                key={`hl-${item.dkPosition}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: item.x - HIGHLIGHT_PADDING,
                  top: PADDING_VERTICAL + item.y - HIGHLIGHT_PADDING,
                  width: item.columnWidth + HIGHLIGHT_PADDING * 2,
                  height: item.totalItemHeight + HIGHLIGHT_PADDING * 2,
                  borderRadius: HIGHLIGHT_RADIUS,
                  backgroundColor: highlightColor,
                }}
              />
            ))}
            {/* Canvas chunks — split to stay within Metal texture size limits */}
            {canvasChunks.map((chunk, idx) => (
              <Canvas
                key={idx}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: PADDING_VERTICAL + chunk.startY,
                  left: 0,
                  width: containerWidth,
                  height: chunk.height,
                }}>
                {chunk.items.map(item => (
                  <React.Fragment key={item.dkPosition}>
                    {item.strokeParagraph && (
                      <Paragraph
                        paragraph={item.strokeParagraph}
                        x={item.x + (item.columnWidth - item.arabicWidth) / 2}
                        y={item.y - chunk.startY}
                        width={item.arabicWidth}
                      />
                    )}
                    <Paragraph
                      paragraph={item.paragraph}
                      x={item.x + (item.columnWidth - item.arabicWidth) / 2}
                      y={item.y - chunk.startY}
                      width={item.arabicWidth}
                    />
                  </React.Fragment>
                ))}
              </Canvas>
            ))}
            {/* Dividers + translation/transliteration overlays */}
            {computedLayout.items.map(item => {
              if (item.isEndMarker) return null;
              return (
                <View
                  key={`sub-${item.dkPosition}`}
                  style={[
                    styles.subTextOverlay,
                    {
                      left: item.x,
                      top: PADDING_VERTICAL + item.y + item.arabicHeight,
                      width: item.columnWidth,
                    },
                  ]}>
                  <View
                    style={[
                      styles.divider,
                      {backgroundColor: derivedColors.divider},
                    ]}
                  />
                  {showTransliteration && (
                    <Text
                      style={[
                        styles.transliterationText,
                        {color: derivedColors.transliteration},
                      ]}>
                      {item.transliteration}
                    </Text>
                  )}
                  {showTranslation && (
                    <Text
                      style={[
                        styles.translationText,
                        {color: derivedColors.translation},
                      ]}>
                      {item.translation}
                    </Text>
                  )}
                </View>
              );
            })}
          </Pressable>
        </View>
      );
    }

    // Fallback: flex-wrap with RN Text (no Skia canvases)
    // Used when: fontMgr not ready, or containerWidth not measured yet
    return (
      <View onLayout={handleLayout} style={styles.fallbackContainer}>
        {hafsNotice}
        {matchedWords.map(({dkWord, wbwWord}) => (
          <Pressable
            key={dkWord.wordPositionInVerse}
            style={[
              styles.fallbackWordUnit,
              selectedWordPosition === wbwWord.position && {
                backgroundColor: highlightColor,
                borderRadius: HIGHLIGHT_RADIUS,
              },
            ]}
            onPress={onTap}
            onLongPress={() => {
              mediumHaptics();
              onWordPress(wbwWord.position);
            }}>
            <Text
              style={[
                styles.fallbackArabicText,
                {
                  color: textColor,
                  fontSize: moderateScale(arabicFontSize),
                  fontFamily: dkFontFamily,
                },
              ]}>
              {dkWord.text}
            </Text>
            <View
              style={[styles.divider, {backgroundColor: derivedColors.divider}]}
            />
            {showTransliteration && (
              <Text
                style={[
                  styles.transliterationText,
                  {color: derivedColors.transliteration},
                ]}>
                {wbwWord.transliteration}
              </Text>
            )}
            {showTranslation && (
              <Text
                style={[
                  styles.translationText,
                  {color: derivedColors.translation},
                ]}>
                {wbwWord.translation}
              </Text>
            )}
          </Pressable>
        ))}
        {verseEndMarker && (
          <View style={styles.fallbackWordUnit}>
            <Text
              style={[
                styles.fallbackArabicText,
                {
                  color: textColor,
                  fontSize: moderateScale(arabicFontSize),
                  fontFamily: dkFontFamily,
                },
              ]}>
              {verseEndMarker.text}
            </Text>
          </View>
        )}
      </View>
    );
  },
);

WBWVerseView.displayName = 'WBWVerseView';

const styles = StyleSheet.create({
  hafsNotice: {
    fontFamily: 'Manrope-Medium',
    fontSize: moderateScale(10.5),
    textAlign: 'center',
    marginBottom: verticalScale(4),
  },
  // --- Optimized single-canvas layout ---
  singleCanvasContainer: {
    position: 'relative',
    width: '100%',
  },
  subTextOverlay: {
    position: 'absolute',
    alignItems: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '80%',
    marginVertical: DIVIDER_MARGIN,
  },
  transliterationText: {
    fontFamily: 'Manrope-Regular',
    fontSize: moderateScale(10.5),
    fontStyle: 'italic',
    textAlign: 'center',
  },
  translationText: {
    fontFamily: 'Manrope-Regular',
    fontSize: moderateScale(11),
    textAlign: 'center',
  },
  // --- Fallback flex-wrap layout (no Skia) ---
  fallbackContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: GAP,
    paddingVertical: PADDING_VERTICAL,
  },
  fallbackWordUnit: {
    alignItems: 'center',
  },
  fallbackArabicText: {
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
