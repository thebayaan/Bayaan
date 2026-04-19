import React from 'react';
import {Canvas, Group} from '@shopify/react-native-skia';
import type {Template, RenderContext} from './types';
import {IG_STORY_WIDTH, IG_STORY_HEIGHT} from './StoryBackgroundCanvas';

interface Props {
  template: Template;
  ctx: RenderContext;
  /** Preview width in pt — height derives from 9:16 aspect. */
  width: number;
}

export const StoryPreviewCanvas: React.FC<Props> = ({template, ctx, width}) => {
  const height = (width * IG_STORY_HEIGHT) / IG_STORY_WIDTH;
  const scale = width / IG_STORY_WIDTH;
  const dims = template.getStickerDimensions(ctx);
  const Background = template.Background;
  const Sticker = template.Sticker;

  const stickerX = (IG_STORY_WIDTH - dims.width) / 2;
  const stickerY = (IG_STORY_HEIGHT - dims.height) / 2;

  return (
    <Canvas style={{width, height}}>
      <Group transform={[{scale}]}>
        <Background ctx={ctx} />
        <Group transform={[{translateX: stickerX}, {translateY: stickerY}]}>
          <Sticker ctx={ctx} />
        </Group>
      </Group>
    </Canvas>
  );
};
