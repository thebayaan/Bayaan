import React, {forwardRef} from 'react';
import {View} from 'react-native';
import {Canvas, type CanvasRef} from '@shopify/react-native-skia';
import type {Template, RenderContext} from './types';

export const IG_STORY_WIDTH = 1080;
export const IG_STORY_HEIGHT = 1920;

interface Props {
  template: Template;
  ctx: RenderContext;
}

export const StoryBackgroundCanvas = forwardRef<CanvasRef, Props>(
  ({template, ctx}, ref) => {
    const Background = template.Background;
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -IG_STORY_WIDTH * 10, // render off-screen
          top: 0,
          width: IG_STORY_WIDTH,
          height: IG_STORY_HEIGHT,
          opacity: 0,
        }}>
        <Canvas
          ref={ref}
          style={{width: IG_STORY_WIDTH, height: IG_STORY_HEIGHT}}>
          <Background ctx={ctx} />
        </Canvas>
      </View>
    );
  },
);
StoryBackgroundCanvas.displayName = 'StoryBackgroundCanvas';
