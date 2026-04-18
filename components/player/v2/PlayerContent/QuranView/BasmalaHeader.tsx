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
} from '@shopify/react-native-skia';
import {BASMALLAH_TEXT} from '@/services/mushaf/DigitalKhattDataService';
import {getBasmalaTajweedMap} from '@/services/mushaf/DigitalKhattVerseTajweedService';
import {tajweedColors} from '@/constants/tajweedColors';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';

const paragraphStyle = {
  textHeightBehavior: TextHeightBehavior.DisableAll,
  textDirection: TextDirection.RTL,
};

// Module-scope cache for basmala paragraph + layout metrics
interface BasmalaCacheEntry {
  key: string;
  paragraph: ReturnType<ReturnType<typeof Skia.ParagraphBuilder.Make>['build']>;
  height: number;
  xPos: number;
  maxWidth: number;
}
let basmalaCache: BasmalaCacheEntry | null = null;

function getOrBuildBasmala(
  fontMgr: SkTypefaceFontProvider,
  width: number,
  textColor: string,
  dkFontFamily: string,
  fontSize: number,
  charToRule: Map<number, string> | null,
  showTajweed: boolean,
): BasmalaCacheEntry {
  const cacheKey = `${width}:${textColor}:${dkFontFamily}:${fontSize}:${showTajweed}`;
  if (basmalaCache?.key === cacheKey) return basmalaCache;

  const color = Skia.Color(textColor);
  const baseStyle: SkTextStyle = {
    color,
    fontFamilies: [dkFontFamily],
    fontSize,
    fontFeatures: [{name: 'basm', value: 1}],
  };

  const builder = Skia.ParagraphBuilder.Make(paragraphStyle, fontMgr);
  builder.pushStyle(baseStyle);

  for (let i = 0; i < BASMALLAH_TEXT.length; i++) {
    const char = BASMALLAH_TEXT.charAt(i);
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
  const maxWidth = width * 2;
  p.layout(maxWidth);
  const lineWidth = p.getLongestLine();

  basmalaCache = {
    key: cacheKey,
    paragraph: p,
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
}

const BasmalaHeader: React.FC<BasmalaHeaderProps> = ({
  visible,
  width,
  textColor,
  showTajweed,
  fontMgr,
  dkFontFamily,
  indexedTajweedData,
}) => {
  const charToRule = useMemo(() => {
    if (!showTajweed || !indexedTajweedData) return null;
    return getBasmalaTajweedMap(indexedTajweedData);
  }, [showTajweed, indexedTajweedData]);

  const fontSize = moderateScale(BASMALA_FONT_SIZE);

  const containerStyle = visible
    ? styles.container
    : [styles.container, styles.hidden];

  // Skia rendering path — width is known synchronously, cache returns instantly on surah change
  if (fontMgr && width > 0) {
    const {paragraph, height, xPos, maxWidth} = getOrBuildBasmala(
      fontMgr,
      width,
      textColor,
      dkFontFamily,
      fontSize,
      charToRule,
      showTajweed,
    );
    // Extra horizontal room so the basm glyph isn't clipped at canvas edges.
    // V2 font renders a wider basm glyph — scale padding with width for larger devices.
    const hPad = Math.max(moderateScale(16), width * 0.06);
    return (
      <View style={containerStyle}>
        <Canvas style={{width: width + hPad * 2, height, direction: 'rtl'}}>
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
        indexedTajweedData={indexedTajweedData}
        showTajweed={showTajweed}
        textColor={textColor}
        fontSize={fontSize}
      />
    </View>
  );
};

// Extracted fallback to keep the main component body lean
const BasmalaFallbackText: React.FC<{
  indexedTajweedData: IndexedTajweedData | null;
  showTajweed: boolean;
  textColor: string;
  fontSize: number;
}> = ({indexedTajweedData, showTajweed, textColor, fontSize}) => {
  const fallbackNodes = useMemo(() => {
    if (!indexedTajweedData) return null;
    const tajweedWords = indexedTajweedData['1:1'];
    if (!tajweedWords) return null;

    const basmalaWords = BASMALLAH_TEXT.split(' ');
    const nodes: React.ReactNode[] = [];

    for (let i = 0; i < basmalaWords.length; i++) {
      const wordPosition = i + 1;
      const tajweedWord = tajweedWords.find(w => {
        const pos = parseInt(w.location.split(':')[2], 10);
        return pos === wordPosition;
      });

      if (tajweedWord) {
        tajweedWord.segments.forEach((segment, segIndex) => {
          const color =
            showTajweed && segment.rule
              ? tajweedColors[segment.rule] || textColor
              : textColor;
          nodes.push(
            <Text key={`basm-${i}-${segIndex}`} style={{color}}>
              {segment.text}
            </Text>,
          );
        });
      } else {
        nodes.push(
          <Text key={`basm-${i}`} style={{color: textColor}}>
            {basmalaWords[i]}
          </Text>,
        );
      }

      if (i < basmalaWords.length - 1) {
        nodes.push(<Text key={`basm-sp-${i}`}> </Text>);
      }
    }

    return nodes;
  }, [indexedTajweedData, showTajweed, textColor]);

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
      {BASMALLAH_TEXT}
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
