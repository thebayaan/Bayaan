import React, {useMemo, useState, useCallback} from 'react';
import {View, Text, StyleSheet, type LayoutChangeEvent} from 'react-native';
import {verticalScale} from 'react-native-size-matters';
import {Canvas, Skia, useFont, useFonts} from '@shopify/react-native-skia';
import {SURAH_DIVIDER_CHAR} from '@/constants/surahNameGlyphs';
import SkiaSurahHeader from '@/components/mushaf/skia/SkiaSurahHeader';

const REFERENCE_SIZE = 100;
const NAME_SCALE = 0.5;

const fallbackSurahNames: Record<number, string> = {};
(require('@/data/surahData.json') as Array<{id: number; name: string}>).forEach(
  s => {
    fallbackSurahNames[s.id] = s.name;
  },
);

interface SurahDividerProps {
  surahNumber: number;
  textColor: string;
  nameColor: string;
  variant?: 'withIcon' | 'withoutIcon';
}

const SurahDivider: React.FC<SurahDividerProps> = ({
  surahNumber,
  textColor,
  nameColor,
  variant = 'withIcon',
}) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setContainerWidth(prev => (Math.abs(prev - w) > 1 ? w : prev));
  }, []);

  const refDividerFont = useFont(
    require('@/data/mushaf/quran-common.ttf'),
    REFERENCE_SIZE,
  );

  const nameFontMgr = useFonts({
    SurahNameV4: [require('@/data/mushaf/surah-name-v4.ttf')],
    SurahNameQCF: [require('@/data/mushaf/surah-name-qcf.ttf')],
  });

  // Compute scaled divider font + name size from container width
  const scaledDividerFont = useMemo(() => {
    if (!refDividerFont || containerWidth <= 0) return null;

    const dividerTypeface = refDividerFont.getTypeface();
    if (!dividerTypeface) return null;

    const ids = refDividerFont.getGlyphIDs(SURAH_DIVIDER_CHAR);
    const widths = refDividerFont.getGlyphWidths(ids);
    const measuredW = widths[0] || 1;
    const scaledSize = (containerWidth / measuredW) * REFERENCE_SIZE;

    const font = Skia.Font(dividerTypeface, scaledSize);
    const metrics = font.getMetrics();
    const divHeight = Math.abs(metrics.ascent) + metrics.descent;

    return {
      font,
      nameFontSize: scaledSize * NAME_SCALE,
      divHeight,
    };
  }, [refDividerFont, containerWidth]);

  // Skia rendering path — delegates to shared SkiaSurahHeader
  if (scaledDividerFont && nameFontMgr && containerWidth > 0) {
    return (
      <View style={styles.container} onLayout={handleLayout}>
        <Canvas
          style={{
            width: containerWidth,
            height: scaledDividerFont.divHeight,
          }}>
          <SkiaSurahHeader
            dividerFont={scaledDividerFont.font}
            fontMgr={nameFontMgr}
            nameFontSize={scaledDividerFont.nameFontSize}
            surahNumber={surahNumber}
            yPos={0}
            pageWidth={containerWidth}
            dividerColor={textColor}
            nameColor={nameColor}
            lineHeight={scaledDividerFont.divHeight}
            variant={variant}
          />
        </Canvas>
      </View>
    );
  }

  // Text-based fallback (fonts not loaded yet)
  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Text style={[styles.fallbackText, {color: nameColor}]}>
        {fallbackSurahNames[surahNumber] || `Surah ${surahNumber}`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: verticalScale(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
  },
});

export default React.memo(SurahDivider);
