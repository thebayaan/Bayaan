import React, {useEffect, useMemo, useReducer} from 'react';
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
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {getTextAllahNameCharMap} from '@/services/mushaf/AllahNameHighlightService';
import {getVerseTajweedMap} from '@/services/mushaf/DigitalKhattVerseTajweedService';
import {tajweedColors} from '@/constants/tajweedColors';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import type {
  MushafArabicTextWeight,
  RewayahId,
} from '@/store/mushafSettingsStore';
import {
  createTextStrokePaint,
  getArabicTextWeightStrokeWidth,
} from '@/utils/skiaTextWeight';

const paragraphStyle = {
  textHeightBehavior: TextHeightBehavior.DisableAll,
  textDirection: TextDirection.RTL,
};

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
  const [, bump] = useReducer(x => x + 1, 0);
  useEffect(() => {
    if (!rewayah || rewayah === digitalKhattDataService.rewayah) return;
    let cancelled = false;
    digitalKhattDataService.ensureRewayahLoaded(rewayah).then(() => {
      if (!cancelled) bump();
    });
    return () => {
      cancelled = true;
    };
  }, [rewayah]);

  const verseText = useMemo(
    () =>
      text ??
      (verseKey ? digitalKhattDataService.getVerseText(verseKey, rewayah) : ''),
    [text, verseKey, rewayah],
  );

  const charToRule = useMemo(() => {
    if (!verseKey || !showTajweed || !indexedTajweedData) return null;
    return getVerseTajweedMap(verseKey, indexedTajweedData);
  }, [verseKey, showTajweed, indexedTajweedData]);

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
