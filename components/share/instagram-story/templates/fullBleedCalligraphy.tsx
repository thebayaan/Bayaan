import React, {useMemo} from 'react';
import {
  LinearGradient,
  Paragraph,
  RadialGradient,
  Rect,
  Skia,
  TextAlign,
  vec,
  type SkParagraphStyle,
  type SkTextStyle,
} from '@shopify/react-native-skia';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {IG_STORY_HEIGHT, IG_STORY_WIDTH} from '../StoryBackgroundCanvas';
import type {RenderContext, StickerDimensions, Template} from '../types';

const VERSE_FONT_SIZE = 120;
const STICKER_WIDTH = 950;
const BG_STOP_TOP = '#0a0f14';
const BG_STOP_BOT = '#050b10';

function buildFullBleedParagraph(ctx: RenderContext) {
  const verseText = ctx.verseKeys
    .map(vk => digitalKhattDataService.getVerseText(vk, ctx.rewayah) ?? '')
    .filter(Boolean)
    .join(' ');
  const paraStyle: SkParagraphStyle = {
    textAlign: TextAlign.Center,
  };
  const builder = Skia.ParagraphBuilder.Make(paraStyle, ctx.fontMgr);
  const textStyle: SkTextStyle = {
    fontFamilies: [ctx.fontFamily],
    fontSize: VERSE_FONT_SIZE,
    color: Skia.Color('#f4f3ec'),
    heightMultiplier: 1.8,
  };
  builder.pushStyle(textStyle).addText(verseText).pop();
  const paragraph = builder.build();
  paragraph.layout(STICKER_WIDTH);
  return paragraph;
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
    <Rect
      x={0}
      y={0}
      width={IG_STORY_WIDTH}
      height={IG_STORY_HEIGHT}
      opacity={0.15}>
      <RadialGradient
        c={vec(IG_STORY_WIDTH * 0.3, IG_STORY_HEIGHT * 0.2)}
        r={IG_STORY_WIDTH * 0.5}
        colors={['#b4915f', 'transparent']}
      />
    </Rect>
    <Rect
      x={0}
      y={0}
      width={IG_STORY_WIDTH}
      height={IG_STORY_HEIGHT}
      opacity={0.18}>
      <RadialGradient
        c={vec(IG_STORY_WIDTH * 0.7, IG_STORY_HEIGHT * 0.8)}
        r={IG_STORY_WIDTH * 0.5}
        colors={['#503c78', 'transparent']}
      />
    </Rect>
  </>
);

const Sticker: React.FC<{ctx: RenderContext}> = ({ctx}) => {
  const paragraph = useMemo(() => buildFullBleedParagraph(ctx), [ctx]);
  return <Paragraph paragraph={paragraph} x={0} y={0} width={STICKER_WIDTH} />;
};

function getStickerDimensions(ctx: RenderContext): StickerDimensions {
  const p = buildFullBleedParagraph(ctx);
  return {width: STICKER_WIDTH, height: p.getHeight()};
}

export const fullBleedCalligraphyTemplate: Template = {
  id: 'fullbleed-calligraphy',
  name: 'Full-bleed',
  backgroundColorTop: BG_STOP_TOP,
  backgroundColorBottom: BG_STOP_BOT,
  Background,
  Sticker,
  getStickerDimensions,
};
