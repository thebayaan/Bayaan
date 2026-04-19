// Ornate circular ayah-number ornament and cross-surah `+` tag are
// deferred as visual polish — initial ship renders the verse block
// inside a double-ruled gold frame on cream paper, which is visually
// distinct from the other templates and communicates the mushaf motif.

import React, {useMemo} from 'react';
import {
  BlendMode,
  Group,
  LinearGradient,
  Paragraph,
  Path,
  RadialGradient,
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
const STICKER_PADDING = 56;
const STICKER_RADIUS = 14;
const PAGE_PAPER_TOP = '#f4ead2';
const PAGE_PAPER_BOT = '#eadcb0';
const BORDER_GOLD = '#8a6420';
const BORDER_OUTER_INSET = 12;
const BORDER_INNER_INSET = 20;
const BG_STOP_TOP = '#1a0f08';
const BG_STOP_BOT = '#0a0703';
const BG_GLOW_COLOR = '#78582eaa';

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
    false, // light theme (paper)
    true, // watermark
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

const Background: React.FC<{ctx: RenderContext}> = () => (
  <>
    <Rect x={0} y={0} width={IG_STORY_WIDTH} height={IG_STORY_HEIGHT}>
      <LinearGradient
        start={vec(0, 0)}
        end={vec(0, IG_STORY_HEIGHT)}
        colors={[BG_STOP_TOP, BG_STOP_BOT]}
      />
    </Rect>
    <Rect x={0} y={0} width={IG_STORY_WIDTH} height={IG_STORY_HEIGHT}>
      <RadialGradient
        c={vec(IG_STORY_WIDTH * 0.5, IG_STORY_HEIGHT)}
        r={IG_STORY_WIDTH * 0.75}
        colors={[BG_GLOW_COLOR, 'transparent']}
      />
    </Rect>
  </>
);

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

  const nameColorPaint = useMemo(() => {
    const paint = Skia.Paint();
    paint.setColorFilter(
      Skia.ColorFilter.MakeBlend(
        Skia.Color(BORDER_GOLD),
        BlendMode.SrcIn,
      ),
    );
    return paint;
  }, []);

  const nodes: React.ReactNode[] = [];
  let y = padding + CARD_TOP_PADDING * scale;

  elements.sections.forEach((section, i) => {
    if (i > 0) y += CARD_SURAH_GAP * scale;

    nodes.push(
      <Paragraph
        key={`div-${i}`}
        paragraph={section.dividerParagraph}
        x={padding}
        y={y}
        width={contentWidth}
      />,
    );

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
          <Path path={starburstPath} color={BORDER_GOLD} />
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
      {/* Cream paper backdrop */}
      <RoundedRect
        x={0}
        y={0}
        width={STICKER_WIDTH}
        height={totalHeight}
        r={STICKER_RADIUS}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, totalHeight)}
          colors={[PAGE_PAPER_TOP, PAGE_PAPER_BOT]}
        />
      </RoundedRect>

      {/* Outer gold rule */}
      <RoundedRect
        x={BORDER_OUTER_INSET}
        y={BORDER_OUTER_INSET}
        width={STICKER_WIDTH - BORDER_OUTER_INSET * 2}
        height={totalHeight - BORDER_OUTER_INSET * 2}
        r={STICKER_RADIUS - 6}
        color={BORDER_GOLD}
        style="stroke"
        strokeWidth={2}
      />

      {/* Inner gold rule (double-rule effect) */}
      <RoundedRect
        x={BORDER_INNER_INSET}
        y={BORDER_INNER_INSET}
        width={STICKER_WIDTH - BORDER_INNER_INSET * 2}
        height={totalHeight - BORDER_INNER_INSET * 2}
        r={STICKER_RADIUS - 10}
        color={BORDER_GOLD}
        style="stroke"
        strokeWidth={1}
      />

      {nodes}
    </>
  );
};

export const mushafPageTemplate: Template = {
  id: 'mushaf-page',
  name: 'Mushaf Page',
  backgroundColorTop: BG_STOP_TOP,
  backgroundColorBottom: BG_STOP_BOT,
  Background,
  Sticker,
  getStickerDimensions,
};
