import React, {forwardRef} from 'react';
import {View} from 'react-native';
import {Canvas, type CanvasRef} from '@shopify/react-native-skia';
import type {Template, RenderContext} from './types';

interface Props {
  template: Template;
  ctx: RenderContext;
}

export const StoryStickerCanvas = forwardRef<CanvasRef, Props>(
  ({template, ctx}, ref) => {
    const Sticker = template.Sticker;
    const dims = template.getStickerDimensions(ctx);
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -dims.width * 10,
          top: 0,
          width: dims.width,
          height: dims.height,
          opacity: 0,
        }}>
        {/* No <Rect> background — preserves alpha in captured PNG */}
        <Canvas ref={ref} style={{width: dims.width, height: dims.height}}>
          <Sticker ctx={ctx} />
        </Canvas>
      </View>
    );
  },
);
StoryStickerCanvas.displayName = 'StoryStickerCanvas';
