// Gold accent on surah-header/basmallah is deferred — requires optional
// accentColor param on buildShareCardParagraphs. Tracked as a follow-up;
// this template ships with default dark-theme text colors.

import React, {useMemo} from 'react';
import {
  BlendMode,
  Circle,
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
const STICKER_PADDING = 40;
const STICKER_RADIUS = 36;
const BG_STOP_TOP = '#2b1d0a';
const BG_STOP_MID = '#0f0a14';
const BG_STOP_BOT = '#050b10';
const STICKER_BG_TOP = '#0c1a24';
const STICKER_BG_BOT = '#050b10';
const STICKER_BORDER = '#be914640';
const STAR_COUNT = 40;
const STAR_SEED = 0x5e3e7;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

const STARS: readonly Star[] = (() => {
  const rand = mulberry32(STAR_SEED);
  const out: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    out.push({
      cx: rand() * IG_STORY_WIDTH,
      cy: 80 + rand() * (IG_STORY_HEIGHT * 0.65 - 80),
      r: 2 + rand() * 1.5,
      opacity: 0.3 + rand() * 0.5,
    });
  }
  return out;
})();

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
    true, // isDarkMode
    true, // showWatermark
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
    <>
      <Rect x={0} y={0} width={IG_STORY_WIDTH} height={IG_STORY_HEIGHT}>
        <LinearGradient
          start={vec(IG_STORY_WIDTH * 0.2, 0)}
          end={vec(IG_STORY_WIDTH * 0.8, IG_STORY_HEIGHT)}
          colors={[BG_STOP_TOP, BG_STOP_MID, BG_STOP_BOT]}
          positions={[0, 0.5, 1]}
        />
      </Rect>
      <Rect x={0} y={0} width={IG_STORY_WIDTH} height={IG_STORY_HEIGHT}>
        <RadialGradient
          c={vec(IG_STORY_WIDTH * 0.3, IG_STORY_HEIGHT * 0.1)}
          r={IG_STORY_WIDTH * 0.6}
          colors={['#be91464d', 'transparent']}
        />
      </Rect>
      {STARS.map((s, i) => (
        <Circle
          key={`star-${i}`}
          cx={s.cx}
          cy={s.cy}
          r={s.r}
          color="#f4f3ec"
          opacity={s.opacity}
        />
      ))}
    </>
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
      {/* Dark gradient card backdrop with hairline gold border */}
      <RoundedRect
        x={0}
        y={0}
        width={STICKER_WIDTH}
        height={totalHeight}
        r={STICKER_RADIUS}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, totalHeight)}
          colors={[STICKER_BG_TOP, STICKER_BG_BOT]}
        />
      </RoundedRect>
      <RoundedRect
        x={0.5}
        y={0.5}
        width={STICKER_WIDTH - 1}
        height={totalHeight - 1}
        r={STICKER_RADIUS - 0.5}
        color={STICKER_BORDER}
        style="stroke"
        strokeWidth={1}
      />
      {nodes}
    </>
  );
};

export const midnightGoldTemplate: Template = {
  id: 'midnight-gold',
  name: 'Midnight Gold',
  backgroundColorTop: BG_STOP_TOP,
  backgroundColorBottom: BG_STOP_BOT,
  Background,
  Sticker,
  getStickerDimensions,
};
