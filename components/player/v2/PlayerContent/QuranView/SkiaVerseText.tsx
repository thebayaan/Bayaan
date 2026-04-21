import React, {useMemo} from 'react';
import {
  Canvas,
  Paragraph,
  Skia,
  TextHeightBehavior,
  TextDirection,
  type SkTypefaceFontProvider,
  type SkTextStyle,
} from '@shopify/react-native-skia';
import {getVerseTajweedMap} from '@/services/mushaf/DigitalKhattVerseTajweedService';
import {tajweedColors} from '@/constants/tajweedColors';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {useRewayahText} from '@/hooks/useRewayahWords';

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
  const {text: resolvedText} = useRewayahText(
    text !== undefined ? null : (verseKey ?? null),
    effectiveRewayah,
  );
  const verseText = text ?? resolvedText;

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
