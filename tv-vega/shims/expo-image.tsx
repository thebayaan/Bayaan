import React from 'react';
import {
  Image as NativeImage,
  ImageProps as NativeImageProps,
  ImageResizeMode,
} from 'react-native';

/**
 * Vega stand-in for expo-image. Amazon's Vega expo-image port (2.0, built for
 * Expo 50) crashes the app as soon as an image renders on RN 0.83, so shared
 * code's `expo-image` imports resolve here and render React Native's Image.
 * Only the props the TV app uses are supported; caching hints are dropped.
 */

type ContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

export type ImageProps = Omit<NativeImageProps, 'source'> & {
  source: NativeImageProps['source'] | null;
  contentFit?: ContentFit;
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  priority?: 'low' | 'normal' | 'high';
  transition?: number;
};

const RESIZE_MODES: Record<ContentFit, ImageResizeMode> = {
  cover: 'cover',
  contain: 'contain',
  fill: 'stretch',
  none: 'center',
  'scale-down': 'contain',
};

export function Image({
  source,
  contentFit = 'cover',
  cachePolicy: _cachePolicy,
  priority: _priority,
  transition: _transition,
  ...rest
}: ImageProps): React.ReactElement | null {
  if (source == null) return null;
  return (
    <NativeImage
      {...rest}
      source={source}
      resizeMode={RESIZE_MODES[contentFit]}
    />
  );
}
