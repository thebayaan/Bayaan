import React, {useEffect, useMemo, useReducer} from 'react';
import {
  Canvas,
  Paragraph,
  Skia,
  TextHeightBehavior,
  TextDirection,
  type SkTypefaceFontProvider,
  type SkTextStyle,
} from '@shopify/react-native-skia';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {getVerseTajweedMap} from '@/services/mushaf/DigitalKhattVerseTajweedService';
import {tajweedColors} from '@/constants/tajweedColors';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import type {RewayahId} from '@/store/mushafSettingsStore';

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

  if (!paragraph || width <= 0) return null;

  return (
    <Canvas pointerEvents="none" style={{width, height, direction: 'rtl'}}>
      <Paragraph paragraph={paragraph} x={0} y={0} width={width} />
    </Canvas>
  );
};

export default React.memo(SkiaVerseText);
