import React, {useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
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
// @ai-start
import {
  BASMALLAH_TEXT,
  rewayahBasmalaService,
} from '@/services/mushaf/RewayahBasmalaService';
// @ai-end
import {getTextAllahNameCharMap} from '@/services/mushaf/AllahNameHighlightService';
import {getBasmalaTajweedMap} from '@/services/mushaf/DigitalKhattVerseTajweedService';
import {tajweedColors} from '@/constants/tajweedColors';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import {
  useMushafSettingsStore,
  type MushafArabicTextWeight,
  type RewayahId,
} from '@/store/mushafSettingsStore';
import {
  createTextStrokePaint,
  getArabicTextWeightStrokeWidth,
} from '@/utils/skiaTextWeight';

const paragraphStyle = {
  textHeightBehavior: TextHeightBehavior.DisableAll,
  textDirection: TextDirection.RTL,
};

// Module-scope cache for basmala paragraph + layout metrics
interface BasmalaCacheEntry {
  key: string;
  paragraph: ReturnType<ReturnType<typeof Skia.ParagraphBuilder.Make>['build']>;
  strokeParagraph: ReturnType<
    ReturnType<typeof Skia.ParagraphBuilder.Make>['build']
  > | null;
  height: number;
  xPos: number;
  maxWidth: number;
}
let basmalaCache: BasmalaCacheEntry | null = null;

function getOrBuildBasmala(
  fontMgr: SkTypefaceFontProvider,
  text: string, // @ai
  width: number,
  textColor: string,
  dkFontFamily: string,
  fontSize: number,
  charToRule: Map<number, string> | null,
  showTajweed: boolean,
  arabicTextWeight: MushafArabicTextWeight,
  showAllahNameHighlight: boolean,
  allahNameHighlightColor?: string,
): BasmalaCacheEntry {
  // The text is part of the key: each rewayah (and surah) may draw its own
  // basmala. @ai
  const cacheKey = `${text}:${width}:${textColor}:${dkFontFamily}:${fontSize}:${showTajweed}:${arabicTextWeight}:${showAllahNameHighlight}:${allahNameHighlightColor ?? ''}`; // @ai
  if (basmalaCache?.key === cacheKey) return basmalaCache;

  const color = Skia.Color(textColor);
  const strokeWidth = getArabicTextWeightStrokeWidth(
    arabicTextWeight,
    fontSize,
  );
  const baseStyle: SkTextStyle = {
    color,
    fontFamilies: [dkFontFamily],
    fontSize,
    fontFeatures: [{name: 'basm', value: 1}],
  };
  const charToAllahHighlight =
    showAllahNameHighlight && allahNameHighlightColor
      ? getTextAllahNameCharMap(text) // @ai
      : null;

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

    for (let i = 0; i < text.length; i++) {
      // @ai
      const char = text.charAt(i); // @ai
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
    return p;
  };

  const p = buildParagraph(false);
  const strokeP = strokeWidth > 0 ? buildParagraph(true) : null;
  const maxWidth = width * 2;
  p.layout(maxWidth);
  strokeP?.layout(maxWidth);
  const lineWidth = p.getLongestLine();

  basmalaCache = {
    key: cacheKey,
    paragraph: p,
    strokeParagraph: strokeP,
    height: p.getHeight(),
    xPos: -(maxWidth - width + (width - lineWidth) / 2),
    maxWidth,
  };
  return basmalaCache;
}

// Fixed size for basmallah — always renders at the default (level 5) size,
// independent of the user's arabic font size preference.
const BASMALA_FONT_SIZE = 26;

interface BasmalaHeaderProps {
  visible: boolean;
  width: number;
  textColor: string;
  showTajweed: boolean;
  fontMgr: SkTypefaceFontProvider | null;
  dkFontFamily: string;
  indexedTajweedData: IndexedTajweedData | null;
  arabicTextWeight?: MushafArabicTextWeight;
  showAllahNameHighlight?: boolean;
  allahNameHighlightColor?: string;
  /** Rewayah of the surrounding verses (player: the track's rewayah).
   *  Defaults to the active mushaf rewayah. Hafs (QPC) tajweed is painted
   *  only in a Hafs context. */
  rewayah?: RewayahId;
  // @ai-start
  /** Surah this basmala opens. The basmala drawn is that rewayah's own
   *  (contract C6), in the surah's own spelling when its Word file has one
   *  (e.g. al-Susi 14 and 15); omitted, the rewayah's usual spelling. */
  surahNumber?: number;
  // @ai-end
}

const BasmalaHeader: React.FC<BasmalaHeaderProps> = ({
  visible,
  width,
  textColor,
  showTajweed: showTajweedSetting,
  fontMgr,
  dkFontFamily,
  indexedTajweedData,
  arabicTextWeight = 'normal',
  showAllahNameHighlight = false,
  allahNameHighlightColor,
  rewayah,
  surahNumber, // @ai
}) => {
  const mushafRewayah = useMushafSettingsStore(s => s.rewayah);
  // @ai-start
  const textRewayah = rewayah ?? mushafRewayah;
  // Never the Hafs basmala for another rewayah: '' when it has no basmala
  // data, and then nothing is drawn.
  const basmalaText = rewayahBasmalaService.getText(textRewayah, surahNumber);
  // Hafs (QPC) tajweed is mapped onto BASMALLAH_TEXT only.
  const showTajweed =
    showTajweedSetting &&
    textRewayah === 'hafs' &&
    basmalaText === BASMALLAH_TEXT;
  // @ai-end
  const charToRule = useMemo(() => {
    if (!showTajweed || !indexedTajweedData) return null;
    return getBasmalaTajweedMap(indexedTajweedData);
  }, [showTajweed, indexedTajweedData]);

  const fontSize = moderateScale(BASMALA_FONT_SIZE);

  // @ai-start
  const containerStyle =
    visible && basmalaText
      ? styles.container
      : [styles.container, styles.hidden];
  if (!basmalaText) return <View style={containerStyle} />;
  // @ai-end

  // Skia rendering path — width is known synchronously, cache returns instantly on surah change
  if (fontMgr && width > 0) {
    const {paragraph, strokeParagraph, height, xPos, maxWidth} =
      getOrBuildBasmala(
        fontMgr,
        basmalaText, // @ai
        width,
        textColor,
        dkFontFamily,
        fontSize,
        charToRule,
        showTajweed,
        arabicTextWeight,
        showAllahNameHighlight,
        allahNameHighlightColor,
      );
    // Extra horizontal room so the basm glyph isn't clipped at canvas edges.
    // V2 font renders a wider basm glyph — scale padding with width for larger devices.
    const hPad = Math.max(moderateScale(16), width * 0.06);
    return (
      <View style={containerStyle}>
        <Canvas style={{width: width + hPad * 2, height, direction: 'rtl'}}>
          {strokeParagraph && (
            <Paragraph
              paragraph={strokeParagraph}
              x={xPos + hPad}
              y={0}
              width={maxWidth}
            />
          )}
          <Paragraph
            paragraph={paragraph}
            x={xPos + hPad}
            y={0}
            width={maxWidth}
          />
        </Canvas>
      </View>
    );
  }

  // Text-based fallback
  return (
    <View style={containerStyle}>
      <BasmalaFallbackText
        text={basmalaText} // @ai
        indexedTajweedData={indexedTajweedData}
        showTajweed={showTajweed}
        textColor={textColor}
        fontSize={fontSize}
        showAllahNameHighlight={showAllahNameHighlight}
        allahNameHighlightColor={allahNameHighlightColor}
      />
    </View>
  );
};

// Extracted fallback to keep the main component body lean
const BasmalaFallbackText: React.FC<{
  text: string; // @ai
  indexedTajweedData: IndexedTajweedData | null;
  showTajweed: boolean;
  textColor: string;
  fontSize: number;
  showAllahNameHighlight?: boolean;
  allahNameHighlightColor?: string;
}> = ({
  text, // @ai
  indexedTajweedData,
  showTajweed,
  textColor,
  fontSize,
  showAllahNameHighlight = false,
  allahNameHighlightColor,
}) => {
  const charToRule = useMemo(() => {
    if (!showTajweed || !indexedTajweedData) return null;
    return getBasmalaTajweedMap(indexedTajweedData);
  }, [showTajweed, indexedTajweedData]);

  const charToAllahHighlight = useMemo(
    () =>
      showAllahNameHighlight && allahNameHighlightColor
        ? getTextAllahNameCharMap(text) // @ai
        : null,
    [text, showAllahNameHighlight, allahNameHighlightColor], // @ai
  );

  const fallbackNodes = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    for (let i = 0; i < text.length; i++) {
      // @ai
      const color =
        charToAllahHighlight?.has(i) && allahNameHighlightColor
          ? allahNameHighlightColor
          : showTajweed && charToRule?.get(i)
            ? tajweedColors[charToRule.get(i)!] || textColor
            : textColor;
      nodes.push(
        <Text key={`basm-char-${i}`} style={{color}}>
          {text.charAt(i) /* @ai */}
        </Text>,
      );
    }

    return nodes;
  }, [
    text, // @ai
    showTajweed,
    textColor,
    charToRule,
    charToAllahHighlight,
    allahNameHighlightColor,
  ]);

  if (fallbackNodes) {
    return (
      <Text style={[styles.fallbackText, {fontSize, fontFamily: 'Uthmani'}]}>
        {fallbackNodes}
      </Text>
    );
  }

  return (
    <Text
      style={[
        styles.fallbackText,
        {color: textColor, fontSize, fontFamily: 'Uthmani'},
      ]}>
      {text /* @ai */}
    </Text>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: verticalScale(0),
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: {
    height: 0,
    overflow: 'hidden' as const,
  },
  fallbackText: {
    textAlign: 'center',
  },
});

export default React.memo(BasmalaHeader);
