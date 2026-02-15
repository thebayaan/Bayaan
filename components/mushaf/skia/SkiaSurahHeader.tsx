import React, {useMemo} from 'react';
import {
  Text as SkiaText,
  Paragraph,
  Group,
  Skia,
  BlendMode,
  type SkFont,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import {
  SURAH_DIVIDER_CHAR,
  SURAH_ICON_CHAR,
  getSurahNameChar,
  getQCFSurahNameChar,
} from '@/constants/surahNameGlyphs';

/** 'withIcon' — QCF font, single glyph includes decorative "سورة" icon.
 *  'withoutIcon' — V4 font, name-only glyph + separate icon glyph. */
type SurahNameVariant = 'withIcon' | 'withoutIcon';

interface SkiaSurahHeaderProps {
  dividerFont: SkFont;
  fontMgr: SkTypefaceFontProvider;
  nameFontSize: number;
  surahNumber: number;
  yPos: number;
  pageWidth: number;
  dividerColor: string;
  nameColor: string;
  lineHeight: number;
  variant?: SurahNameVariant;
  xOffset?: number;
}

const SkiaSurahHeader: React.FC<SkiaSurahHeaderProps> = ({
  dividerFont,
  fontMgr,
  nameFontSize,
  surahNumber,
  yPos,
  pageWidth,
  dividerColor,
  nameColor,
  lineHeight,
  variant = 'withIcon',
  xOffset = 0,
}) => {
  const divColor = useMemo(() => Skia.Color(dividerColor), [dividerColor]);

  // Measure and position divider frame (centered within lineHeight)
  const dividerLayout = useMemo(() => {
    const ids = dividerFont.getGlyphIDs(SURAH_DIVIDER_CHAR);
    const widths = dividerFont.getGlyphWidths(ids);
    const glyphWidth = widths[0] || 0;
    const metrics = dividerFont.getMetrics();
    const x = xOffset + (pageWidth - glyphWidth) / 2;
    const glyphHeight = Math.abs(metrics.ascent) + metrics.descent;
    const verticalOffset = Math.max(0, (lineHeight - glyphHeight) / 2);
    const baselineY = yPos + verticalOffset + Math.abs(metrics.ascent);
    return {x, baselineY};
  }, [dividerFont, yPos, pageWidth, lineHeight, xOffset]);

  // ── withIcon: QCF font — single glyph includes name + icon ──
  const qcfNameStr = useMemo(
    () => (variant === 'withIcon' ? getQCFSurahNameChar(surahNumber) : ''),
    [variant, surahNumber],
  );

  const qcfParagraph = useMemo(() => {
    if (!qcfNameStr) return null;
    const builder = Skia.ParagraphBuilder.Make({}, fontMgr);
    builder.pushStyle({
      color: Skia.Color(nameColor),
      fontFamilies: ['SurahNameQCF'],
      fontSize: nameFontSize,
    });
    builder.addText(qcfNameStr);
    builder.pop();
    const p = builder.build();
    p.layout(pageWidth);
    return p;
  }, [qcfNameStr, fontMgr, nameColor, nameFontSize, pageWidth]);

  const qcfLayout = useMemo(() => {
    if (!qcfParagraph) return null;
    const w = qcfParagraph.getLongestLine();
    const h = qcfParagraph.getHeight();
    const nudgeUp = lineHeight * 0.03;
    return {
      x: xOffset + (pageWidth - w) / 2,
      y: yPos + (lineHeight - h) / 2 - nudgeUp,
      w,
    };
  }, [qcfParagraph, yPos, pageWidth, lineHeight, xOffset]);

  // QCF font has hardcoded black SVG fills — recolor with a SrcIn color filter
  const qcfColorPaint = useMemo(() => {
    const paint = Skia.Paint();
    paint.setColorFilter(
      Skia.ColorFilter.MakeBlend(Skia.Color(nameColor), BlendMode.SrcIn),
    );
    return paint;
  }, [nameColor]);

  // ── withoutIcon: V4 font — separate icon + name paragraphs ──
  const v4NameStr = useMemo(
    () => (variant === 'withoutIcon' ? getSurahNameChar(surahNumber) : ''),
    [variant, surahNumber],
  );

  const v4IconParagraph = useMemo(() => {
    if (variant !== 'withoutIcon') return null;
    const builder = Skia.ParagraphBuilder.Make({}, fontMgr);
    builder.pushStyle({
      color: Skia.Color(nameColor),
      fontFamilies: ['SurahNameV4'],
      fontSize: nameFontSize,
    });
    builder.addText(SURAH_ICON_CHAR);
    builder.pop();
    const p = builder.build();
    p.layout(pageWidth);
    return p;
  }, [variant, fontMgr, nameColor, nameFontSize, pageWidth]);

  const v4NameParagraph = useMemo(() => {
    if (!v4NameStr) return null;
    const builder = Skia.ParagraphBuilder.Make({}, fontMgr);
    builder.pushStyle({
      color: Skia.Color(nameColor),
      fontFamilies: ['SurahNameV4'],
      fontSize: nameFontSize,
    });
    builder.addText(v4NameStr);
    builder.pop();
    const p = builder.build();
    p.layout(pageWidth);
    return p;
  }, [v4NameStr, fontMgr, nameColor, nameFontSize, pageWidth]);

  const v4Layout = useMemo(() => {
    if (!v4NameParagraph || !v4IconParagraph) return null;
    const iconW = v4IconParagraph.getLongestLine();
    const nameW = v4NameParagraph.getLongestLine();
    const gap = nameFontSize * 0.15;
    const totalW = iconW + gap + nameW;
    const startX = xOffset + (pageWidth - totalW) / 2;
    const iconH = v4IconParagraph.getHeight();
    const nameH = v4NameParagraph.getHeight();
    const nudgeUp = lineHeight * 0.03;
    return {
      nameX: startX,
      nameY: yPos + (lineHeight - nameH) / 2 - nudgeUp,
      nameW,
      iconX: startX + nameW + gap,
      iconY: yPos + (lineHeight - iconH) / 2 - nudgeUp,
      iconW,
    };
  }, [
    v4IconParagraph,
    v4NameParagraph,
    yPos,
    pageWidth,
    lineHeight,
    nameFontSize,
    xOffset,
  ]);

  return (
    <>
      <SkiaText
        text={SURAH_DIVIDER_CHAR}
        font={dividerFont}
        x={dividerLayout.x}
        y={dividerLayout.baselineY}
        color={divColor}
      />

      {/* withIcon: QCF single glyph (recolored via SrcIn filter) */}
      {qcfLayout && qcfParagraph && (
        <Group layer={qcfColorPaint}>
          <Paragraph
            paragraph={qcfParagraph}
            x={qcfLayout.x}
            y={qcfLayout.y}
            width={qcfLayout.w}
          />
        </Group>
      )}

      {/* withoutIcon: V4 icon + name */}
      {v4Layout && (
        <>
          <Paragraph
            paragraph={v4IconParagraph!}
            x={v4Layout.iconX}
            y={v4Layout.iconY}
            width={v4Layout.iconW}
          />
          {v4NameParagraph && (
            <Paragraph
              paragraph={v4NameParagraph}
              x={v4Layout.nameX}
              y={v4Layout.nameY}
              width={v4Layout.nameW}
            />
          )}
        </>
      )}
    </>
  );
};

export default React.memo(SkiaSurahHeader);
