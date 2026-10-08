import React, {useEffect, useMemo} from 'react';
import {
  Canvas,
  Paragraph,
  Group,
  RoundedRect,
  Skia,
  TextHeightBehavior,
  TextDirection,
  type SkTypefaceFontProvider,
  type SkTextStyle,
  type SkColor,
} from '@shopify/react-native-skia';
import {getTextAllahNameCharMap} from '@/services/mushaf/AllahNameHighlightService';
import {layoutWords} from '@/services/mushaf/lineWordSpans';
import {
  tajweedColors,
  REWAYAH_DIFF_BACKGROUND,
} from '@/constants/tajweedColors';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';
import type {
  MushafArabicTextWeight,
  RewayahId,
} from '@/store/mushafSettingsStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  useRewayahWords,
  type RewayahWordsStatus, // @ai
} from '@/hooks/useRewayahWords';
import {
  createTextStrokePaint,
  getArabicTextWeightStrokeWidth,
} from '@/utils/skiaTextWeight';
import {computeVerseCharRuleMap, computeVerseDiffRanges} from './verseOverlays';

const paragraphStyle = {
  textHeightBehavior: TextHeightBehavior.DisableAll,
  textDirection: TextDirection.RTL,
};

// Corner radius for the rewayah-diff background tint; matches SkiaLine's
// 4px so list-mode and page-mode highlights look identical.
const DIFF_BG_RADIUS = 4;

const EMPTY_WORDS: DKWordInfo[] = [];

interface SkiaVerseTextProps {
  verseKey?: string;
  text?: string;
  fontMgr: SkTypefaceFontProvider;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  showTajweed: boolean;
  width: number;
  indexedTajweedData: IndexedTajweedData | null;
  arabicTextWeight?: MushafArabicTextWeight;
  showAllahNameHighlight?: boolean;
  allahNameHighlightColor?: string;
  /** Render text from this rewayah's DK words DB instead of the active
   *  mushaf one. Used by the player to show text matching the currently
   *  playing reciter's rewayah. Ignored if `text` prop is provided. */
  rewayah?: RewayahId;
  /** Rendered (instead of nothing) while the verse's words cannot be drawn
   *  yet: still loading, or failed / unavailable. @ai */
  renderPlaceholder?: (status: RewayahWordsStatus) => React.ReactNode;
  // @ai-start
  /** Draw exactly these words of `rewayah` (a rewayah verse row's own slots,
   *  verseUnitRows.ts) instead of reading `verseKey`'s words; overlays apply
   *  as usual. `verseKey` then only names the Hafs verse for Hafs tajweed
   *  (a Hafs verse row). Ignored if `text` is provided. */
  words?: readonly DKWordInfo[];
  // @ai-end
}

const SkiaVerseText: React.FC<SkiaVerseTextProps> = ({
  verseKey,
  text,
  fontMgr,
  fontFamily,
  fontSize,
  textColor,
  showTajweed,
  width,
  indexedTajweedData,
  arabicTextWeight = 'normal',
  showAllahNameHighlight = false,
  allahNameHighlightColor,
  rewayah,
  renderPlaceholder, // @ai
  words: givenWords, // @ai
}) => {
  // When no explicit prop, follow the mushaf setting. This is the mushaf
  // list-mode / preview case; the player passes an explicit prop.
  const mushafRewayah = useMushafSettingsStore(s => s.rewayah);
  const effectiveRewayah = (rewayah ?? mushafRewayah) as Parameters<
    typeof useRewayahWords
  >[1];

  // Reactive read; re-renders when the requested rewayah's cache transitions
  // from loading → ready (or the words cache changes). Only queried when
  // `text` isn't provided directly.
  const {words: verseWords, status} = useRewayahWords(
    text !== undefined || givenWords ? null : (verseKey ?? null), // @ai
    effectiveRewayah,
  );
  // @ai — a verse row's own words, else the words of `verseKey`.
  const words = givenWords ?? verseWords;
  // The rendered verse string: blank slots skipped, single spaces, multi-token
  // slots whole. Every overlay below indexes into this exact string.
  const wordsText = useMemo(() => layoutWords(words).text, [words]);
  const verseText = text ?? (status === 'ready' ? wordsText : '');

  // Pre-built `text` inputs (share card / similar-verse snippets) have no
  // per-word metadata, so no tajweed or rewayah highlight applies to them.
  const showRewayahDiffs = useMushafSettingsStore(s => s.showRewayahDiffs);
  const textProvided = text !== undefined;
  const overlayWords = textProvided ? EMPTY_WORDS : words;

  // Char→rule map: Hafs tajweed base layer (Hafs text only) + rewayah
  // foreground categories / silah on top (only with 'Show differences' on
  // and for the active mushaf rewayah, whose diff data is loaded). Same
  // precedence as SkiaPage / ContinuousMushafView.
  const charToRule = useMemo(
    () =>
      textProvided
        ? null
        : computeVerseCharRuleMap({
            verseKey,
            words: overlayWords,
            rewayah: effectiveRewayah,
            mushafRewayah,
            showTajweed,
            indexedTajweedData,
            showRewayahDiffs,
          }),
    [
      textProvided,
      verseKey,
      overlayWords,
      effectiveRewayah,
      mushafRewayah,
      showTajweed,
      indexedTajweedData,
      showRewayahDiffs,
    ],
  );

  const charToAllahHighlight = useMemo(() => {
    if (!showAllahNameHighlight || !allahNameHighlightColor || !verseText) {
      return null;
    }
    return getTextAllahNameCharMap(verseText);
  }, [showAllahNameHighlight, allahNameHighlightColor, verseText]);

  const built = useMemo(() => {
    if (!verseText || width <= 0) {
      return {paragraph: null, strokeParagraph: null, height: 0, yOffset: 0};
    }

    const color = Skia.Color(textColor);
    const strokeWidth = getArabicTextWeightStrokeWidth(
      arabicTextWeight,
      fontSize,
    );
    const yOffset = Math.ceil(strokeWidth);
    const baseStyle: SkTextStyle = {
      color,
      fontFamilies: [fontFamily],
      fontSize,
    };

    const buildParagraph = (withStroke: boolean) => {
      const builder = Skia.ParagraphBuilder.Make(paragraphStyle, fontMgr);

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

      pushStyle(baseStyle, color);

      for (let i = 0; i < verseText.length; i++) {
        const char = verseText.charAt(i);
        const allahHighlight = charToAllahHighlight?.has(i);
        const rule = charToRule?.get(i);
        const resolvedColor = allahHighlight
          ? allahNameHighlightColor
          : rule && tajweedColors[rule]
            ? tajweedColors[rule]
            : null;

        if (resolvedColor) {
          const charColor = Skia.Color(resolvedColor);
          const charStyle: SkTextStyle = {
            ...baseStyle,
            color: charColor,
          };
          pushStyle(charStyle, charColor);
          builder.addText(char);
          builder.pop();
        } else {
          builder.addText(char);
        }
      }

      builder.pop();
      const p = builder.build();
      p.layout(width);
      return p;
    };

    const p = buildParagraph(false);
    const strokeP = strokeWidth > 0 ? buildParagraph(true) : null;
    return {
      paragraph: p,
      strokeParagraph: strokeP,
      height: p.getHeight() + yOffset * 2,
      yOffset,
    };
  }, [
    verseText,
    width,
    textColor,
    fontFamily,
    fontSize,
    fontMgr,
    charToRule,
    charToAllahHighlight,
    arabicTextWeight,
    allahNameHighlightColor,
  ]);

  const {paragraph, strokeParagraph, height, yOffset} = built;

  // SkParagraph holds native memory that JS GC does not reclaim. Dispose the
  // previous paragraphs when the memo recomputes (and on unmount). The cleanup
  // runs with the prior `built` value, so the paragraph being rendered this
  // frame is never disposed early.
  useEffect(() => {
    return () => {
      built.paragraph?.dispose();
      built.strokeParagraph?.dispose();
    };
  }, [built]);

  // Rewayah diff backgrounds: whole-word variants (differs from Hafs), drawn
  // under the text. Same data and gates as the page renderers (which use
  // getDiffRangesForLine), over the verse-level word list; a trailing inline
  // verse marker is never tinted.
  const diffBgRects = useMemo(() => {
    if (!paragraph || textProvided) return null;
    const ranges = computeVerseDiffRanges({
      words: overlayWords,
      rewayah: effectiveRewayah,
      mushafRewayah,
      showRewayahDiffs,
    });
    if (ranges.length === 0) return null;

    const rects: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];
    for (const r of ranges) {
      try {
        // getRectsForRange uses a half-open range [start, end).
        const skRects = paragraph.getRectsForRange(r.start, r.end + 1);
        for (const rect of skRects) {
          rects.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          });
        }
      } catch {
        // Ignore per-range failures; don't want one bad range to wipe
        // the whole set of highlights on this verse.
      }
    }
    return rects.length > 0 ? rects : null;
  }, [
    paragraph,
    textProvided,
    showRewayahDiffs,
    effectiveRewayah,
    mushafRewayah,
    overlayWords,
  ]);

  if (!paragraph || width <= 0) {
    return renderPlaceholder ? <>{renderPlaceholder(status)}</> : null; // @ai
  }

  return (
    <Canvas pointerEvents="none" style={{width, height, direction: 'rtl'}}>
      {diffBgRects && (
        <Group>
          {diffBgRects.map((rect, i) => (
            <RoundedRect
              key={i}
              x={rect.x}
              y={rect.y + yOffset}
              width={rect.width}
              height={rect.height}
              r={DIFF_BG_RADIUS}
              color={REWAYAH_DIFF_BACKGROUND}
            />
          ))}
        </Group>
      )}
      {strokeParagraph && (
        <Paragraph
          paragraph={strokeParagraph}
          x={0}
          y={yOffset}
          width={width}
        />
      )}
      <Paragraph paragraph={paragraph} x={0} y={yOffset} width={width} />
    </Canvas>
  );
};

export default React.memo(SkiaVerseText);
