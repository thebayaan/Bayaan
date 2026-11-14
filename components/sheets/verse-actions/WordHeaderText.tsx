// @ai-generated
/**
 * The word at the top of the Word Study card, drawn as the word-by-word grid
 * draws it: the mushaf's own (DigitalKhatt) Hafs text of the word's slots,
 * never the word-by-word text (damaged in some words, 2:4:9), in the user's
 * mushaf face, centred, with the tajweed, Allah-name highlight and text
 * weight of the settings.
 *
 * A small paragraph builder of its own rather than SkiaVerseText: that one
 * reads tajweed through getVerseTajweedMap, which caches one map per verse
 * key, so drawing one word of a verse with it would leave that word's map in
 * the cache for the whole verse (and a whole verse's map would colour the
 * word wrongly). Tajweed is aligned per slot here, as WBWVerseView aligns it
 * per word.
 *
 * Until the mushaf font manager is ready the word is React Native Text in
 * the DigitalKhatt face registered for it (rnQuranFontFamily), never a UI
 * font.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Text, View, type LayoutChangeEvent} from 'react-native';
import {
  Canvas,
  Paragraph,
  Skia,
  TextAlign,
  TextDirection,
  TextHeightBehavior,
  type SkColor,
  type SkParagraphStyle,
  type SkTextStyle,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import {tajweedColors} from '@/constants/tajweedColors';
import {wordContainsAllahName} from '@/services/mushaf/AllahNameHighlightService';
import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';
import {
  alignWordTajweed,
  detectWordTafkhim,
} from '@/services/mushaf/TajweedAlignmentService';
import type {MushafArabicTextWeight} from '@/store/mushafSettingsStore';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import {
  createTextStrokePaint,
  getArabicTextWeightStrokeWidth,
} from '@/utils/skiaTextWeight';
import {disposeAfterPendingDraws} from '@/utils/skiaDeferredDispose';

const paragraphStyle: SkParagraphStyle = {
  textHeightBehavior: TextHeightBehavior.DisableAll,
  textDirection: TextDirection.RTL,
  textAlign: TextAlign.Center,
};

/** Arabic line pitch (ipad-standards §4.2): at least 2.0x the font size. */
const LINE_PITCH = 2;

type Slot = Pick<DKWordInfo, 'text' | 'wordPositionInVerse'>;
type TajweedWords = IndexedTajweedData[string];

/** The word's text: its slots joined by a space (two for بَعْدَ مَا). */
export function headerWordText(slots: readonly Slot[]): string {
  return slots.map(slot => slot.text).join(' ');
}

/**
 * The colour of each coloured character of headerWordText(slots), slot by
 * slot as the word-by-word grid colours a word: a slot holding the Allah
 * name takes the highlight colour whole; otherwise its tajweed (the Hafs QPC
 * rules of its position aligned onto its text, or the tafkhim detected in
 * it). `tajweedWords` is null when tajweed is off.
 */
export function headerCharColors(
  slots: readonly Slot[],
  tajweedWords: TajweedWords | null,
  allahNameHighlightColor: string | undefined,
): Map<number, string> {
  const colors = new Map<number, string>();
  let start = 0;
  for (const slot of slots) {
    if (allahNameHighlightColor && wordContainsAllahName(slot.text)) {
      for (let i = 0; i < slot.text.length; i++) {
        colors.set(start + i, allahNameHighlightColor);
      }
    } else if (tajweedWords) {
      const tajweedWord = tajweedWords.find(
        w => Number(w.location.split(':')[2]) === slot.wordPositionInVerse,
      );
      const rules = tajweedWord
        ? alignWordTajweed(slot.text, tajweedWord.segments)
        : detectWordTafkhim(slot.text);
      rules?.forEach((rule, i) => {
        const color = tajweedColors[rule];
        if (color && i < slot.text.length) colors.set(start + i, color);
      });
    }
    start += slot.text.length + 1;
  }
  return colors;
}

export interface WordHeaderTextProps {
  /** The Hafs verse of the word (its tajweed data). */
  verseKey: string;
  /** The word's Hafs slots, in order. */
  slots: readonly Slot[];
  fontMgr: SkTypefaceFontProvider | null;
  /** The Skia face (getDkFontFamily of the renderer, Hafs). */
  fontFamily: string;
  /** The React Native face of the fallback (rnQuranFontFamily). */
  rnFontFamily: string;
  /** In points (the reading size, not scaled). */
  fontSize: number;
  color: string;
  showTajweed: boolean;
  indexedTajweedData: IndexedTajweedData | null;
  arabicTextWeight: MushafArabicTextWeight;
  /** Set only when the Allah-name highlight is on. */
  allahNameHighlightColor?: string;
}

/** The word, centred; a heading for VoiceOver, read in Arabic. */
export const WordHeaderText: React.FC<WordHeaderTextProps> = ({
  verseKey,
  slots,
  fontMgr,
  fontFamily,
  rnFontFamily,
  fontSize,
  color,
  showTajweed,
  indexedTajweedData,
  arabicTextWeight,
  allahNameHighlightColor,
}) => {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setWidth(prev => (Math.abs(prev - w) > 1 ? w : prev));
  }, []);

  const text = useMemo(() => headerWordText(slots), [slots]);
  const verseTajweed = indexedTajweedData?.[verseKey] ?? null;
  const tajweedWords = showTajweed ? verseTajweed : null;
  const charColors = useMemo(
    () => headerCharColors(slots, tajweedWords, allahNameHighlightColor),
    [slots, tajweedWords, allahNameHighlightColor],
  );

  const built = useMemo(() => {
    if (!fontMgr || !text || width <= 0) return null;
    const strokeWidth = getArabicTextWeightStrokeWidth(
      arabicTextWeight,
      fontSize,
    );
    const baseColor = Skia.Color(color);
    const base: SkTextStyle = {
      color: baseColor,
      fontFamilies: [fontFamily],
      fontSize,
    };
    const build = (withStroke: boolean) => {
      const builder = Skia.ParagraphBuilder.Make(paragraphStyle, fontMgr);
      const push = (style: SkTextStyle, styleColor: SkColor) => {
        const stroke = withStroke
          ? createTextStrokePaint(styleColor, strokeWidth)
          : undefined;
        if (stroke) builder.pushStyle(style, stroke);
        else builder.pushStyle(style);
      };
      push(base, baseColor);
      for (let i = 0; i < text.length; i++) {
        const charColor = charColors.get(i);
        if (charColor) {
          const skColor = Skia.Color(charColor);
          push({...base, color: skColor}, skColor);
          builder.addText(text.charAt(i));
          builder.pop();
        } else {
          builder.addText(text.charAt(i));
        }
      }
      builder.pop();
      const paragraph = builder.build();
      paragraph.layout(width);
      return paragraph;
    };
    const paragraph = build(false);
    const strokeParagraph = strokeWidth > 0 ? build(true) : null;
    const yOffset = Math.ceil(strokeWidth);
    // The line pitch the reading surfaces keep, centred on the word.
    const height = Math.max(
      Math.ceil(paragraph.getHeight()) + yOffset * 2,
      Math.round(fontSize * LINE_PITCH),
    );
    const y = Math.round((height - paragraph.getHeight()) / 2);
    return {paragraph, strokeParagraph, height, y};
  }, [
    fontMgr,
    text,
    width,
    arabicTextWeight,
    fontSize,
    color,
    fontFamily,
    charColors,
  ]);

  // SkParagraph holds native memory: dispose the previous paragraphs once no
  // queued draw can still use them (utils/skiaDeferredDispose.ts).
  useEffect(
    () => () =>
      disposeAfterPendingDraws([built?.paragraph, built?.strokeParagraph]),
    [built],
  );

  const lineHeight = Math.round(fontSize * LINE_PITCH);
  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="header"
      accessibilityLabel={text}
      accessibilityLanguage="ar"
      style={{minHeight: lineHeight, justifyContent: 'center'}}>
      {built ? (
        <Canvas
          pointerEvents="none"
          style={{width, height: built.height, direction: 'rtl'}}>
          {built.strokeParagraph && (
            <Paragraph
              paragraph={built.strokeParagraph}
              x={0}
              y={built.y}
              width={width}
            />
          )}
          <Paragraph
            paragraph={built.paragraph}
            x={0}
            y={built.y}
            width={width}
          />
        </Canvas>
      ) : fontMgr ? null : (
        <Text
          style={{
            fontFamily: rnFontFamily,
            fontSize,
            lineHeight,
            color,
            textAlign: 'center',
            writingDirection: 'rtl',
          }}>
          {text}
        </Text>
      )}
    </View>
  );
};
