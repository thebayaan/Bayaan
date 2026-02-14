import React, {useMemo, useState, useCallback} from 'react';
import {View, Text, StyleSheet, type LayoutChangeEvent} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
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

interface BasmalaHeaderProps {
  textColor: string;
  showTajweed: boolean;
  fontMgr: SkTypefaceFontProvider | null;
  dkFontFamily: string;
  arabicFontSize: number;
  indexedTajweedData: IndexedTajweedData | null;
}

const BasmalaHeader: React.FC<BasmalaHeaderProps> = ({
  textColor,
  showTajweed,
  fontMgr,
  dkFontFamily,
  arabicFontSize,
  indexedTajweedData,
}) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setContainerWidth(prev => (Math.abs(prev - w) > 1 ? w : prev));
  }, []);

  const charToRule = useMemo(() => {
    if (!showTajweed || !indexedTajweedData) return null;
    return getBasmalaTajweedMap(indexedTajweedData);
  }, [showTajweed, indexedTajweedData]);

  const fontSize = moderateScale(arabicFontSize);

  // Skia paragraph for DK path
  const paragraph = useMemo(() => {
    if (!fontMgr || containerWidth <= 0) return null;

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
    // Layout wide then center manually (same technique as SkiaLine.tsx)
    const maxWidth = containerWidth * 2;
    p.layout(maxWidth);
    return p;
  }, [fontMgr, containerWidth, textColor, dkFontFamily, fontSize, charToRule]);

  // Text-based tajweed fallback nodes
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

  // Skia rendering path
  if (fontMgr) {
    const height = paragraph ? paragraph.getHeight() : 0;
    const maxWidth = containerWidth * 2;
    const lineWidth = paragraph ? paragraph.getLongestLine() : 0;
    const xPos = -(
      maxWidth -
      containerWidth +
      (containerWidth - lineWidth) / 2
    );

    return (
      <View style={styles.container} onLayout={handleLayout}>
        {paragraph && containerWidth > 0 && (
          <Canvas style={{width: containerWidth, height, direction: 'rtl'}}>
            <Paragraph paragraph={paragraph} x={xPos} y={0} width={maxWidth} />
          </Canvas>
        )}
      </View>
    );
  }

  // Text-based fallback
  return (
    <View style={styles.container}>
      {fallbackNodes ? (
        <Text style={[styles.fallbackText, {fontSize, fontFamily: 'Uthmani'}]}>
          {fallbackNodes}
        </Text>
      ) : (
        <Text
          style={[
            styles.fallbackText,
            {color: textColor, fontSize, fontFamily: 'Uthmani'},
          ]}>
          {BASMALLAH_TEXT}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: verticalScale(0),
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    textAlign: 'center',
  },
});

export default React.memo(BasmalaHeader);
