import React, {useMemo} from 'react';
import {
  BlendMode,
  Group,
  LinearGradient,
  Paragraph,
  Path,
  Rect,
  RoundedRect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import {buildShareCardParagraphs} from '../../buildShareCardParagraphs';
import {
  CARD_BASMALLAH_BOTTOM_GAP,
  CARD_HEADER_BOTTOM_GAP,
  CARD_SURAH_GAP,
  CARD_TOP_PADDING,
  CARD_VERSE_BOTTOM_GAP,
  STARBURST_PATH_DATA,
} from '../../shareCardConstants';
import {IG_STORY_HEIGHT, IG_STORY_WIDTH} from '../StoryBackgroundCanvas';
import type {RenderContext, StickerDimensions, Template} from '../types';

const STICKER_WIDTH = 900;
const STICKER_PADDING = 40;
const STICKER_RADIUS = 36;
const BG_STOP_TOP = '#0a1f2c';
const BG_STOP_MID = '#050b10';
const BG_STOP_BOT = '#1a0a2c';
const STICKER_BG = '#f4f3ec';

/** True if the first verse in the range is ayah 1 of its surah. */
function shouldShowBasmallah(verseKeys: string[]): boolean {
  if (verseKeys.length === 0) return false;
  const parts = verseKeys[0].split(':');
  return parts[1] === '1';
}

function buildElements(ctx: RenderContext) {
  return buildShareCardParagraphs(
    ctx.verseKeys,
    STICKER_WIDTH - STICKER_PADDING * 2,
    ctx.fontMgr,
    false,
    true,
    ctx.quranCommonTypeface,
    ctx.fontFamily,
    shouldShowBasmallah(ctx.verseKeys),
    ctx.rewayah,
  );
}

function getStickerDimensions(ctx: RenderContext): StickerDimensions {
  const elements = buildElements(ctx);
  return {
    width: STICKER_WIDTH,
    height: elements.totalHeight + STICKER_PADDING * 2,
  };
}

const Background: React.FC<{ctx: RenderContext}> = () => {
  return (
    <Rect x={0} y={0} width={IG_STORY_WIDTH} height={IG_STORY_HEIGHT}>
      <LinearGradient
        start={vec(IG_STORY_WIDTH * 0.15, 0)}
        end={vec(IG_STORY_WIDTH * 0.85, IG_STORY_HEIGHT)}
        colors={[BG_STOP_TOP, BG_STOP_MID, BG_STOP_BOT]}
        positions={[0, 0.6, 1]}
      />
    </Rect>
  );
};

const Sticker: React.FC<{ctx: RenderContext}> = ({ctx}) => {
  const padding = STICKER_PADDING;
  const contentWidth = STICKER_WIDTH - STICKER_PADDING * 2;
  const scale = 1;

  const elements = useMemo(() => buildElements(ctx), [ctx]);

  const starburstPath = useMemo(
    () => Skia.Path.MakeFromSVGString(STARBURST_PATH_DATA),
    [],
  );

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

  const nodes: React.ReactNode[] = [];
  let y = padding + CARD_TOP_PADDING * scale;

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

  // Rewayah disclosure label (non-Hafs only), centered above watermark.
  if (elements.rewayahLabelParagraph) {
    nodes.push(
      <Paragraph
        key="rewayah-label"
        paragraph={elements.rewayahLabelParagraph}
        x={padding}
        y={y}
        width={contentWidth}
      />,
    );
    y += elements.rewayahLabelHeight;
  }

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

  return (
    <>
      {/* Cream rounded card backdrop */}
      <RoundedRect
        x={0}
        y={0}
        width={STICKER_WIDTH}
        height={totalHeight}
        r={STICKER_RADIUS}
        color={STICKER_BG}
      />
      {nodes}
    </>
  );
};

export const classicCreamTemplate: Template = {
  id: 'classic-cream',
  name: 'Classic Cream',
  backgroundColorTop: BG_STOP_TOP,
  backgroundColorBottom: BG_STOP_BOT,
  Background,
  Sticker,
  getStickerDimensions,
};
