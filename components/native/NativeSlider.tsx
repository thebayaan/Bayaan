// @ai-generated
import React from 'react';
import {Slider} from '@expo/ui/community/slider';
import {useNativeTheme} from './useNativeTheme';
import type {NativeSliderProps} from './types';

/** Web fallback: Expo UI's range input in the same tint. */
export function NativeSlider({
  value,
  minimumValue,
  maximumValue,
  step,
  disabled,
  onValueChange,
  onSlidingComplete,
  accessibilityLabel,
  style,
  testID,
}: NativeSliderProps) {
  const native = useNativeTheme();
  return (
    <Slider
      value={value}
      minimumValue={minimumValue}
      maximumValue={maximumValue}
      step={step}
      disabled={disabled}
      minimumTrackTintColor={native.tint}
      onValueChange={next => {
        onValueChange?.(next);
        onSlidingComplete?.(next);
      }}
      accessibilityLabel={accessibilityLabel}
      style={style}
      testID={testID}
    />
  );
}
