import React, {useMemo} from 'react';
import {
  Canvas,
  Paragraph,
  Rect,
  Group,
  Path,
  Skia,
  BlendMode,
  type SkTypefaceFontProvider,
  type SkTypeface,
} from '@shopify/react-native-skia';
import {buildShareCardParagraphs} from './buildShareCardParagraphs';
import {
  CARD_CONTENT_WIDTH,
  CARD_PADDING,
  CARD_TOP_PADDING,
  CARD_HEADER_BOTTOM_GAP,
  CARD_VERSE_BOTTOM_GAP,
  CARD_SURAH_GAP,
  CARD_BASMALLAH_BOTTOM_GAP,
  STARBURST_PATH_DATA,
} from './shareCardConstants';

interface ShareCardPreviewProps {
  verseKeys: string[];
  isDarkMode: boolean;
  showWatermark: boolean;
  showBasmallah: boolean;
  fontMgr: SkTypefaceFontProvider;
  quranCommonTypeface: SkTypeface | null;
  fontFamily: string;
  width: number;
  /** Optional ref forwarded to the underlying Canvas (used for image capture). */
  canvasRef?: React.RefObject<any>;
}

const ShareCardPreview: React.FC<ShareCardPreviewProps> = ({
  verseKeys,
  isDarkMode,
  showWatermark,
  showBasmallah,
  fontMgr,
  quranCommonTypeface,
  fontFamily,
  width,
  canvasRef,
}) => {
  const padding =
    (CARD_PADDING / (CARD_CONTENT_WIDTH + CARD_PADDING * 2)) * width;
  const contentWidth = width - padding * 2;

  const elements = useMemo(
    () =>
      buildShareCardParagraphs(
        verseKeys,
        contentWidth,
        fontMgr,
        isDarkMode,
        showWatermark,
        quranCommonTypeface,
        fontFamily,
        showBasmallah,
      ),
    [
      verseKeys,
      contentWidth,
      fontMgr,
      isDarkMode,
      showWatermark,
      quranCommonTypeface,
      fontFamily,
      showBasmallah,
    ],
  );

  const starburstPath = useMemo(
    () => Skia.Path.MakeFromSVGString(STARBURST_PATH_DATA),
    [],
  );

  const scale = contentWidth / CARD_CONTENT_WIDTH;
  const totalHeight = elements.totalHeight + padding * 2;

  // QCF font has hardcoded black SVG fills — recolor with SrcIn filter
  const nameColorPaint = useMemo(() => {
    const paint = Skia.Paint();
    paint.setColorFilter(
      Skia.ColorFilter.MakeBlend(
        Skia.Color(elements.colors.text),
        BlendMode.SrcIn,
      ),
    );
    return paint;
  }, [elements.colors.text]);

  return (
    <Canvas ref={canvasRef} style={{width, height: totalHeight}}>
      {/* Background */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={totalHeight}
        color={elements.colors.background}
      />

      {/* Sections */}
      {(() => {
        let y = padding + CARD_TOP_PADDING * scale;
        const nodes: React.ReactNode[] = [];

        elements.sections.forEach((section, i) => {
          if (i > 0) y += CARD_SURAH_GAP * scale;

          // Divider (ornamental frame)
          nodes.push(
            <Paragraph
              key={`div-${i}`}
              paragraph={section.dividerParagraph}
              x={padding}
              y={y}
              width={contentWidth}
            />,
          );

          // QCF surah name (centered within divider, recolored)
          const nameY = y + (section.dividerHeight - section.nameHeight) / 2;
          nodes.push(
            <Group key={`name-${i}`} layer={nameColorPaint}>
              <Paragraph
                paragraph={section.nameParagraph}
                x={padding}
                y={nameY}
                width={contentWidth}
              />
            </Group>,
          );

          y += section.dividerHeight + CARD_HEADER_BOTTOM_GAP * scale;

          // Basmallah (between divider and verse text)
          if (section.basmallahParagraph) {
            nodes.push(
              <Paragraph
                key={`basm-${i}`}
                paragraph={section.basmallahParagraph}
                x={padding}
                y={y}
                width={contentWidth}
              />,
            );
            y += section.basmallahHeight + CARD_BASMALLAH_BOTTOM_GAP * scale;
          }

          // Verse text
          nodes.push(
            <Paragraph
              key={`verse-${i}`}
              paragraph={section.verseParagraph}
              x={padding}
              y={y}
              width={contentWidth}
            />,
          );

          y += section.verseHeight + CARD_VERSE_BOTTOM_GAP * scale;
        });

        // Watermark: squircle logo + "made with Bayaan" (centered)
        if (elements.watermarkParagraph) {
          const iconSize = elements.watermarkIconSize;
          const gap = elements.watermarkGap;
          const textW = elements.watermarkTextWidth;
          const hasIcon = !!starburstPath;
          const totalWmWidth = (hasIcon ? iconSize + gap : 0) + textW;
          const wmStartX = padding + (contentWidth - totalWmWidth) / 2;

          if (starburstPath) {
            const iconY = y + (elements.watermarkHeight - iconSize) / 2;
            const pathScale = iconSize / 1023;
            const pathYOffset = (iconSize - 872 * pathScale) / 2;
            nodes.push(
              <Group
                key="logo"
                transform={[
                  {translateX: wmStartX},
                  {translateY: iconY + pathYOffset},
                  {scale: pathScale},
                ]}>
                <Path path={starburstPath} color={elements.colors.secondary} />
              </Group>,
            );
          }

          const textX = hasIcon ? wmStartX + iconSize + gap : wmStartX;
          const textParaH = elements.watermarkParagraph.getHeight();
          const textY = y + (elements.watermarkHeight - textParaH) / 2;
          nodes.push(
            <Paragraph
              key="watermark"
              paragraph={elements.watermarkParagraph}
              x={textX}
              y={textY}
              width={textW + 10}
            />,
          );
        }

        return nodes;
      })()}
    </Canvas>
  );
};

export default React.memo(ShareCardPreview);
