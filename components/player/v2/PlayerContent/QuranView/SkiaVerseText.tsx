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
} from '@shopify/react-native-skia';
import {getVerseTajweedMap} from '@/services/mushaf/DigitalKhattVerseTajweedService';
import {
  tajweedColors,
  REWAYAH_DIFF_BACKGROUND,
} from '@/constants/tajweedColors';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {useRewayahWords} from '@/hooks/useRewayahWords';
import {rewayahDiffService} from '@/services/mushaf/RewayahDiffService';

const paragraphStyle = {
  textHeightBehavior: TextHeightBehavior.DisableAll,
  textDirection: TextDirection.RTL,
};

// Corner radius for the rewayah-diff background tint — matches SkiaLine's
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
  /** Rewayah the Arabic text is rendered in. If omitted, falls back to the
   *  mushaf settings store's active rewayah. Ignored if `text` prop is
   *  provided (which short-circuits the lookup entirely). */
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
  rewayah,
}) => {
  // When no explicit prop, follow the mushaf setting. This is the mushaf
  // list-mode / preview case; the player passes an explicit prop.
  const mushafRewayah = useMushafSettingsStore(s => s.rewayah);
  const effectiveRewayah: RewayahId = rewayah ?? mushafRewayah;

  // Reactive read — re-renders when the requested rewayah's cache transitions
  // from loading → ready. Only queried when `text` isn't provided directly.
  const {words, status} = useRewayahWords(
    text !== undefined ? null : (verseKey ?? null),
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

  const {paragraph, height} = useMemo(() => {
    if (!verseText || width <= 0) return {paragraph: null, height: 0};

    const color = Skia.Color(textColor);
    const baseStyle: SkTextStyle = {
      color,
      fontFamilies: [fontFamily],
      fontSize,
    };

    const builder = Skia.ParagraphBuilder.Make(paragraphStyle, fontMgr);
    builder.pushStyle(baseStyle);

    for (let i = 0; i < verseText.length; i++) {
      const char = verseText.charAt(i);
      const rule = charToRule?.get(i);

      if (rule && tajweedColors[rule]) {
        const charStyle: SkTextStyle = {
          ...baseStyle,
          color: Skia.Color(tajweedColors[rule]),
        };
        builder.pushStyle(charStyle);
        builder.addText(char);
        builder.pop();
      } else {
        builder.addText(char);
      }
    }

    builder.pop();
    const p = builder.build();
    p.layout(width);
    return {paragraph: p, height: p.getHeight()};
  }, [verseText, width, textColor, fontFamily, fontSize, fontMgr, charToRule]);

  // Rewayah diff backgrounds — highlights words that differ from Hafs.
  // Mirrors the SkiaPage pipeline (which uses getDiffRangesForLine) but
  // operates on the verse-level word list that useRewayahWords returned.
  // The gating conditions (textProvided / Hafs / toggle / mushaf-setting
  // alignment) are shared with the foreground rule map above — see that
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
        // Ignore per-range failures — don't want one bad range to wipe
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
      {diffBgRects ? (
        <Group>
          {diffBgRects.map((rect, i) => (
            <RoundedRect
              key={i}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              r={DIFF_BG_RADIUS}
              color={REWAYAH_DIFF_BACKGROUND}
            />
          ))}
          <Paragraph paragraph={paragraph} x={0} y={0} width={width} />
        </Group>
      ) : (
        <Paragraph paragraph={paragraph} x={0} y={0} width={width} />
      )}
    </Canvas>
  );
};

export default React.memo(SkiaVerseText);
