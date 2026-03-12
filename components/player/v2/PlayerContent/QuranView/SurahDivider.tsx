import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {verticalScale} from 'react-native-size-matters';
import {Canvas, Skia, useFonts} from '@shopify/react-native-skia';
import {SURAH_DIVIDER_CHAR} from '@/constants/surahNameGlyphs';
import SkiaSurahHeader from '@/components/mushaf/skia/SkiaSurahHeader';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import type {SkFont} from '@shopify/react-native-skia';

const REFERENCE_SIZE = 100;
const NAME_SCALE = 0.32;
const DIVIDER_PADDING_V = verticalScale(4);

const fallbackSurahNames: Record<number, string> = {};
(require('@/data/surahData.json') as Array<{id: number; name: string}>).forEach(
  s => {
    fallbackSurahNames[s.id] = s.name;
  },
);

// Module-scope font cache — recomputed only when width changes (device rotation)
interface DividerFontCache {
  width: number;
  font: SkFont;
  nameFontSize: number;
  divHeight: number;
}
let dividerFontCache: DividerFontCache | null = null;

function getOrBuildDividerFont(width: number): DividerFontCache | null {
  if (width <= 0) return null;
  if (dividerFontCache?.width === width) return dividerFontCache;

  const qcTypeface = mushafPreloadService.quranCommonTypeface;
  if (!qcTypeface) return null;

  const refFont = Skia.Font(qcTypeface, REFERENCE_SIZE);
  const ids = refFont.getGlyphIDs(SURAH_DIVIDER_CHAR);
  const widths = refFont.getGlyphWidths(ids);
  const measuredW = widths[0] || 1;
  const scaledSize = (width / measuredW) * REFERENCE_SIZE;

  const font = Skia.Font(qcTypeface, scaledSize);
  const metrics = font.getMetrics();
  const divHeight = Math.abs(metrics.ascent) + metrics.descent;

  dividerFontCache = {
    width,
    font,
    nameFontSize: scaledSize * NAME_SCALE,
    divHeight,
  };
  return dividerFontCache;
}

export function computeDividerTotalHeight(width: number): number {
  const cache = getOrBuildDividerFont(width);
  return cache ? cache.divHeight + 2 * DIVIDER_PADDING_V : 0;
}

interface SurahDividerProps {
  width: number;
  surahNumber: number;
  textColor: string;
  nameColor: string;
  variant?: 'withIcon' | 'withoutIcon';
}

const SurahDivider: React.FC<SurahDividerProps> = ({
  width,
  surahNumber,
  textColor,
  nameColor,
  variant = 'withIcon',
}) => {
  // Keep useFonts hook as fallback (can't conditionally call hooks).
  // Prefer preloaded fontMgr from MushafPreloadService — ready synchronously.
  const hookFontMgr = useFonts({
    SurahNameV4: [require('@/data/mushaf/surah-name-v4.ttf')],
    SurahNameQCF: [require('@/data/mushaf/surah-name-qcf.ttf')],
  });
  const nameFontMgr = mushafPreloadService.fontMgr || hookFontMgr;

  const scaledDividerFont = getOrBuildDividerFont(width);

  // Skia rendering path — delegates to shared SkiaSurahHeader
  if (scaledDividerFont && nameFontMgr && width > 0) {
    return (
      <View style={styles.container}>
        <Canvas
          style={{
            width,
            height: scaledDividerFont.divHeight,
          }}>
          <SkiaSurahHeader
            dividerFont={scaledDividerFont.font}
            fontMgr={nameFontMgr}
            nameFontSize={scaledDividerFont.nameFontSize}
            surahNumber={surahNumber}
            yPos={0}
            pageWidth={width}
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
    <View style={styles.container}>
      <Text style={[styles.fallbackText, {color: nameColor}]}>
        {fallbackSurahNames[surahNumber] || `Surah ${surahNumber}`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: DIVIDER_PADDING_V,
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
