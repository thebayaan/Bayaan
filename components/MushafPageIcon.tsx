import React, {useMemo} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  Canvas,
  Skia,
  Paragraph,
  Text as SkiaText,
  Group,
  BlendMode,
  TextHeightBehavior,
  TextDirection,
} from '@shopify/react-native-skia';
import {moderateScale} from 'react-native-size-matters';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {
  quranTextService,
  PAGE_WIDTH,
  MARGIN,
  FONTSIZE,
  SPACEWIDTH,
  SpaceType,
} from '@/services/mushaf/QuranTextService';
import {
  JustService,
  type JustResultByLine,
} from '@/services/mushaf/JustificationService';
import {
  digitalKhattDataService,
  type DKLine,
} from '@/services/mushaf/DigitalKhattDataService';
import {mushafLayoutCacheService} from '@/services/mushaf/MushafLayoutCacheService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  SURAH_DIVIDER_CHAR,
  getQCFSurahNameChar,
} from '@/constants/surahNameGlyphs';
import Color from 'color';

const ICON_PAGE = 604;
const LINES_PER_PAGE = 15;

interface MushafPageIconProps {
  size: number;
  color: string;
  borderColor?: string;
}

const MushafPageIcon: React.FC<MushafPageIconProps> = ({
  size,
  color,
  borderColor,
}) => {
  const fontMgr = mushafPreloadService.fontMgr;
  const uthmaniFont = useMushafSettingsStore(s => s.uthmaniFont);
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const fontFamily =
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : uthmaniFont === 'v1'
        ? 'DigitalKhattV1'
        : 'DigitalKhattV2';

  // Icon canvas dimensions (slightly taller than square)
  const canvasWidth = size;
  const canvasHeight = size * 1.15;
  const padding = size * 0.08;
  const contentWidth = canvasWidth - padding * 2;
  const contentHeight = canvasHeight - padding * 2;

  // Scale factors from full page to icon
  const pageScale = contentWidth / PAGE_WIDTH;
  const margin = MARGIN * pageScale;
  const lineWidth = contentWidth - 2 * margin;
  const fontSize = FONTSIZE * pageScale * 0.9;
  const fontSizeLineWidthRatio = fontSize / lineWidth;
  const lineHeight = contentHeight / LINES_PER_PAGE;

  const pageLines = useMemo<DKLine[]>(
    () => digitalKhattDataService.getPageLines(ICON_PAGE),
    [],
  );

  const justResults = useMemo<JustResultByLine[] | null>(() => {
    if (!fontMgr) return null;
    const cached = JustService.getCachedPageLayout(
      fontSizeLineWidthRatio,
      ICON_PAGE,
      fontFamily,
    );
    if (cached) return cached;

    const result = JustService.getPageLayout(
      ICON_PAGE,
      fontSizeLineWidthRatio,
      fontMgr,
      fontFamily,
    );
    if (result.length > 0) {
      mushafLayoutCacheService.setPageLayout(ICON_PAGE, fontFamily, result);
    }
    return result;
  }, [fontMgr, fontSizeLineWidthRatio, fontFamily]);

  // Surah header fonts
  const surahHeaderFonts = useMemo(() => {
    const qcTypeface = mushafPreloadService.quranCommonTypeface;
    if (!qcTypeface) return {dividerFont: null, nameFontSize: 0};

    const refFont = Skia.Font(qcTypeface, 100);
    const ids = refFont.getGlyphIDs('\uE000');
    const widths = refFont.getGlyphWidths(ids);
    const measuredW = widths[0] || 1;
    const scaledSize = (lineWidth / measuredW) * 100;

    return {
      dividerFont: Skia.Font(qcTypeface, scaledSize),
      nameFontSize: scaledSize * 0.4,
    };
  }, [lineWidth]);

  // QCF color paint for surah name recoloring
  const qcfColorPaint = useMemo(() => {
    const paint = Skia.Paint();
    paint.setColorFilter(
      Skia.ColorFilter.MakeBlend(Skia.Color(color), BlendMode.SrcIn),
    );
    return paint;
  }, [color]);

  const dividerSkColor = useMemo(() => {
    return Color(color).alpha(0.5).toString();
  }, [color]);

  const textSkColor = useMemo(() => {
    return Color(color).alpha(0.2).toString();
  }, [color]);

  const resolvedBorderColor = borderColor
    ? borderColor
    : Color(color).alpha(0.15).toString();

  if (!fontMgr || !justResults) {
    return (
      <View
        style={[
          styles.container,
          {
            width: canvasWidth,
            height: canvasHeight,
            borderColor: resolvedBorderColor,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: canvasWidth,
          height: canvasHeight,
          borderColor: resolvedBorderColor,
        },
      ]}>
      <Canvas style={{width: contentWidth, height: contentHeight}}>
        {pageLines.map((line, lineIndex) => {
          const yPos = lineIndex * lineHeight;

          if (line.line_type === 'surah_name') {
            if (!surahHeaderFonts.dividerFont) return null;

            // Render divider
            const divFont = surahHeaderFonts.dividerFont;
            const ids = divFont.getGlyphIDs(SURAH_DIVIDER_CHAR);
            const widths = divFont.getGlyphWidths(ids);
            const glyphWidth = widths[0] || 0;
            const metrics = divFont.getMetrics();
            const divX = (contentWidth - glyphWidth) / 2;
            const glyphH = Math.abs(metrics.ascent) + metrics.descent;
            const baselineY =
              yPos +
              Math.max(0, (lineHeight - glyphH) / 2) +
              Math.abs(metrics.ascent);

            const scaleY = 0.85;
            const originX = contentWidth / 2;
            const originY = yPos + lineHeight / 2;

            // Build surah name paragraph
            const qcfChar = getQCFSurahNameChar(line.surah_number);
            let nameParagraph = null;
            let nameLayout = null;

            if (qcfChar) {
              const builder = Skia.ParagraphBuilder.Make({}, fontMgr);
              builder.pushStyle({
                color: Skia.Color(color),
                fontFamilies: ['SurahNameQCF'],
                fontSize: surahHeaderFonts.nameFontSize,
              });
              builder.addText(qcfChar);
              builder.pop();
              nameParagraph = builder.build();
              nameParagraph.layout(contentWidth);

              const w = nameParagraph.getLongestLine();
              const h = nameParagraph.getHeight();
              nameLayout = {
                x: (contentWidth - w) / 2,
                y: yPos + (lineHeight - h) / 2,
                w,
              };
            }

            return (
              <React.Fragment key={`sh-${lineIndex}`}>
                <Group
                  transform={[{scaleY}]}
                  origin={Skia.Point(originX, originY)}>
                  <SkiaText
                    text={SURAH_DIVIDER_CHAR}
                    font={divFont}
                    x={divX}
                    y={baselineY}
                    color={Skia.Color(dividerSkColor)}
                  />
                </Group>
                {nameParagraph && nameLayout && (
                  <Group layer={qcfColorPaint}>
                    <Paragraph
                      paragraph={nameParagraph}
                      x={nameLayout.x}
                      y={nameLayout.y}
                      width={nameLayout.w}
                    />
                  </Group>
                )}
              </React.Fragment>
            );
          }

          if (!justResults[lineIndex]) return null;

          const justResult = justResults[lineIndex];
          const scale = (fontSize * justResult.fontSizeRatio) / FONTSIZE;
          const lineInfo = quranTextService.getLineInfo(ICON_PAGE, lineIndex);
          const lineText = quranTextService.getLineText(ICON_PAGE, lineIndex);
          const lineTextInfo = quranTextService.analyzeText(
            ICON_PAGE,
            lineIndex,
          );

          if (!lineText) return null;

          let lineMargin = margin;
          if (lineInfo.lineWidthRatio !== 1) {
            const newLineWidth = lineWidth * lineInfo.lineWidthRatio;
            lineMargin += (lineWidth - newLineWidth) / 2;
          }

          const lightColor = Skia.Color(textSkColor);
          const textStyle = {
            color: lightColor,
            fontFamilies: [fontFamily],
            fontSize: justResult.fontSizeRatio * fontSize,
          };

          const paragraphBuilder = Skia.ParagraphBuilder.Make(
            {
              textHeightBehavior: TextHeightBehavior.DisableAll,
              textDirection: TextDirection.RTL,
            },
            fontMgr,
          );
          paragraphBuilder.pushStyle(textStyle);

          for (let wi = 0; wi < lineTextInfo.wordInfos.length; wi++) {
            const wordInfo = lineTextInfo.wordInfos[wi];
            for (let i = wordInfo.startIndex; i <= wordInfo.endIndex; i++) {
              const char = lineText.charAt(i);
              const justInfo = justResult.fontFeatures.get(i);
              if (justInfo) {
                paragraphBuilder.pushStyle({
                  ...textStyle,
                  fontFeatures: justInfo,
                });
                paragraphBuilder.addText(char);
                paragraphBuilder.pop();
              } else {
                paragraphBuilder.addText(char);
              }
            }

            const spaceType = lineTextInfo.spaces.get(wordInfo.endIndex + 1);
            if (spaceType !== undefined) {
              const spacing =
                spaceType === SpaceType.Aya
                  ? (justResult.ayaSpacing - SPACEWIDTH) * scale
                  : (justResult.simpleSpacing - SPACEWIDTH) * scale;
              paragraphBuilder.pushStyle({
                ...textStyle,
                letterSpacing: spacing,
              });
              paragraphBuilder.addText(' ');
              paragraphBuilder.pop();
            }
          }

          paragraphBuilder.pop();
          const paragraph = paragraphBuilder.build();
          const maxWidth = contentWidth * 2;
          paragraph.layout(maxWidth);

          const currLineWidth = paragraph.getLongestLine();
          let xPos: number;
          if (lineInfo.lineType === 1 || lineInfo.lineType === 2) {
            xPos = -(
              maxWidth -
              contentWidth +
              (contentWidth - currLineWidth) / 2
            );
          } else {
            xPos = -(maxWidth - contentWidth + lineMargin);
          }

          return (
            <Paragraph
              key={`l-${lineIndex}`}
              paragraph={paragraph}
              x={xPos}
              y={yPos}
              width={maxWidth}
            />
          );
        })}
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    borderRadius: moderateScale(6),
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default React.memo(MushafPageIcon);
