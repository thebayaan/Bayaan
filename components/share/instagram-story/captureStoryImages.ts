import type {CanvasRef} from '@shopify/react-native-skia';
import {captureShareCard} from '../captureShareCard';

export interface CapturedStoryImages {
  backgroundUri: string;
  stickerUri: string;
}

export async function captureStoryImages(params: {
  backgroundRef: React.RefObject<CanvasRef | null>;
  stickerRef: React.RefObject<CanvasRef | null>;
}): Promise<CapturedStoryImages> {
  const [backgroundUri, stickerUri] = await Promise.all([
    captureShareCard(params.backgroundRef, 'ig-story-bg.png'),
    captureShareCard(params.stickerRef, 'ig-story-sticker.png'),
  ]);
  return {backgroundUri, stickerUri};
}
