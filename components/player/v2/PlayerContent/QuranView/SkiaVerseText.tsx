import React, {useMemo} from 'react';
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
import {getVerseTajweedMap} from '@/services/mushaf/DigitalKhattVerseTajweedService';
import {rewayahDiffService} from '@/services/mushaf/RewayahDiffService';
import {
  tajweedColors,
  REWAYAH_DIFF_BACKGROUND,
} from '@/constants/tajweedColors';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import type {
  MushafArabicTextWeight,
  RewayahId,
} from '@/store/mushafSettingsStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useRewayahWords} from '@/hooks/useRewayahWords';
import {
  createTextStrokePaint,
  getArabicTextWeightStrokeWidth,
} from '@/utils/skiaTextWeight';

const paragraphStyle = {
  textHeightBehavior: TextHeightBehavior.DisableAll,
  textDirection: TextDirection.RTL,
};

// Corner radius for the rewayah-diff background tint; matches SkiaLine's
// 4px so list-mode and page-mode highlights look identical.
const DIFF_BG_RADIUS = 4;

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
}) => {
  // When no explicit prop, follow the mushaf setting. This is the mushaf
  // list-mode / preview case; the player passes an explicit prop.
  const mushafRewayah = useMushafSettingsStore(s => s.rewayah);
  const effectiveRewayah = (rewayah ?? mushafRewayah) as Parameters<
    typeof useRewayahWords
  >[1];

  // Reactive read; re-renders when the requested rewayah's cache transitions
  // from loading → ready. Only queried when `text` isn't provided directly.
  const {words, status} = useRewayahWords(
    text !== undefined ? null : verseKey ?? null,
    effectiveRewayah,
  );
  const verseText =
    text ?? (status === 'ready' ? words.map(w => w.text).join(' ') : '');

  // Rewayah-foreground gate mirrors the diff-background gate below: the
  // singleton rewayahDiffService only carries one rewayah's diff data at
  // a time (the active mushaf setting), so we can't paint fg highlights
  // for a track rewayah that differs from the mushaf setting. Pre-built
  // `text` inputs (share card / similar-verse snippets) have no per-word
  // metadata, so we silently skip them too.
  const showRewayahDiffs = useMushafSettingsStore(s => s.showRewayahDiffs);
  const textProvided = text !== undefined;
  const rewayahFgApplies =
    !textProvided &&
    showRewayahDiffs &&
    effectiveRewayah !== 'hafs' &&
    effectiveRewayah === mushafRewayah &&
    (rewayahDiffService.hasAnyDiffs || rewayahDiffService.hasSilahColoring);

  // Char→rule map: tajweed base layer + rewayah foreground categories
  // (minor/ibdal/tashil/madd/taghliz/silah) on top, so rewayah rules win
  // on conflict. Matches SkiaPage / ContinuousMushafView precedence exactly.
  const charToRule = useMemo(() => {
    const tajweedMap =
      verseKey && showTajweed && indexedTajweedData
        ? getVerseTajweedMap(verseKey, indexedTajweedData)
        : null;
    const rewayahMap =
      rewayahFgApplies && words.length > 0
        ? rewayahDiffService.getRewayahRuleMapForWords(words)
        : null;
    if (!tajweedMap && !rewayahMap) return null;
    if (!rewayahMap) return tajweedMap;
    if (!tajweedMap) return rewayahMap;
    const merged = new Map(tajweedMap);
    for (const [k, v] of rewayahMap) merged.set(k, v);
    return merged;
  }, [verseKey, showTajweed, indexedTajweedData, rewayahFgApplies, words]);

  const charToAllahHighlight = useMemo(() => {
    if (!showAllahNameHighlight || !allahNameHighlightColor || !verseText) {
      return null;
    }
    return getTextAllahNameCharMap(verseText);
  }, [showAllahNameHighlight, allahNameHighlightColor, verseText]);

  const {paragraph, strokeParagraph, height, yOffset} = useMemo(() => {
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

  // Rewayah diff backgrounds; highlights words that differ from Hafs.
  // Mirrors the SkiaPage pipeline (which uses getDiffRangesForLine) but
  // operates on the verse-level word list that useRewayahWords returned.
  // The gating conditions (textProvided / Hafs / toggle / mushaf-setting
  // alignment) are shared with the foreground rule map above; see that
  // block for the reasoning behind each condition.
  const diffBgRects = useMemo(() => {
    if (
      !paragraph ||
      textProvided ||
      !showRewayahDiffs ||
      effectiveRewayah === 'hafs' ||
      effectiveRewayah !== mushafRewayah ||
      !rewayahDiffService.hasDiffs ||
      words.length === 0
    ) {
      return null;
    }
    const ranges = rewayahDiffService.getDiffRangesForWords(words);
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
    words,
  ]);

  if (!paragraph || width <= 0) return null;

  return (
    <Canvas pointerEvents="none" style={{width, height, direction: 'rtl'}}>
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
