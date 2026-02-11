import React, {useMemo, useState, useEffect} from 'react';
import {View, ActivityIndicator, StyleSheet, Dimensions} from 'react-native';
import {Canvas, useFonts} from '@shopify/react-native-skia';
import {
  quranTextService,
  PAGE_WIDTH,
  MARGIN,
  FONTSIZE,
  SPACEWIDTH,
} from '@/services/mushaf/QuranTextService';
import {
  JustService,
  type JustResultByLine,
} from '@/services/mushaf/JustificationService';
import {
  digitalKhattDataService,
  type DKLine,
} from '@/services/mushaf/DigitalKhattDataService';
import SkiaLine from './SkiaLine';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const IS_COMPACT_DEVICE = SCREEN_HEIGHT < 700;

const PAGE_PADDING_HORIZONTAL = IS_COMPACT_DEVICE ? 8 : 16;
const PAGE_PADDING_TOP = IS_COMPACT_DEVICE ? 30 : 110;
const PAGE_PADDING_BOTTOM = IS_COMPACT_DEVICE ? 70 : 130;

const CONTENT_WIDTH = SCREEN_WIDTH - PAGE_PADDING_HORIZONTAL * 2;
const CONTENT_HEIGHT = SCREEN_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;

interface SkiaPageProps {
  pageNumber: number;
  textColor: string;
}

const SkiaPage: React.FC<SkiaPageProps> = ({pageNumber, textColor}) => {
  const fontMgr = useFonts({
    DigitalKhatt: [require('@/data/mushaf/digitalkhatt/DigitalKhattV2.otf')],
  });

  const [justResults, setJustResults] = useState<JustResultByLine[] | null>(
    null,
  );
  const [computing, setComputing] = useState(false);

  // Calculate rendering dimensions
  const scale = CONTENT_WIDTH / PAGE_WIDTH;
  const margin = MARGIN * scale;
  const lineWidth = CONTENT_WIDTH - 2 * margin;
  const fontSize = FONTSIZE * scale * 0.9; // Slight reduction like reference
  const fontSizeLineWidthRatio = fontSize / lineWidth;

  // Get page lines for layout calculation
  const pageLines = useMemo<DKLine[]>(
    () => digitalKhattDataService.getPageLines(pageNumber),
    [pageNumber],
  );

  // Calculate justification
  useEffect(() => {
    if (!fontMgr) return;

    let cancelled = false;

    const computeLayout = async () => {
      setComputing(true);

      // Check cache first
      const cached = await JustService.getLayoutFromStorage(
        fontSizeLineWidthRatio,
      );
      if (cached && cached[pageNumber - 1]) {
        if (!cancelled) {
          setJustResults(cached[pageNumber - 1]);
          setComputing(false);
        }
        return;
      }

      // Compute on the fly
      const result = JustService.getPageLayout(
        pageNumber,
        fontSizeLineWidthRatio,
        fontMgr,
      );
      if (!cancelled) {
        setJustResults(result);
        setComputing(false);
      }
    };

    computeLayout();
    return () => {
      cancelled = true;
    };
  }, [fontMgr, pageNumber, fontSizeLineWidthRatio]);

  if (!fontMgr || !justResults || computing) {
    return (
      <View style={[styles.page, styles.loadingContainer]}>
        <ActivityIndicator size="small" color={textColor} />
      </View>
    );
  }

  // Calculate Y positions for each line
  const interLine = CONTENT_HEIGHT / pageLines.length;
  const shouldCenterVertically = pageNumber === 1 || pageNumber === 2;

  return (
    <View style={styles.page}>
      <Canvas
        style={{
          width: CONTENT_WIDTH,
          height: CONTENT_HEIGHT,
          marginLeft: PAGE_PADDING_HORIZONTAL,
          marginTop: PAGE_PADDING_TOP,
        }}>
        {pageLines.map((line, lineIndex) => {
          if (!justResults[lineIndex]) return null;

          // Skip surah_name lines — they are rendered as RN Text overlays
          if (line.line_type === 'surah_name') return null;

          const yPos = lineIndex * interLine;

          // Adjust margin for lines with lineWidthRatio != 1
          const lineInfo = quranTextService.getLineInfo(pageNumber, lineIndex);
          let lineMargin = margin;
          if (lineInfo.lineWidthRatio !== 1) {
            const newLineWidth = lineWidth * lineInfo.lineWidthRatio;
            lineMargin += (lineWidth - newLineWidth) / 2;
          }

          return (
            <SkiaLine
              key={`${pageNumber}-${lineIndex}`}
              pageNumber={pageNumber}
              lineIndex={lineIndex}
              fontMgr={fontMgr}
              justResult={justResults[lineIndex]}
              pageWidth={CONTENT_WIDTH}
              fontSize={fontSize}
              margin={lineMargin}
              yPos={yPos}
              textColor={textColor}
            />
          );
        })}
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default React.memo(SkiaPage);
