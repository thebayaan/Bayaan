// @ai-generated
import React, {useRef, useState} from 'react';
import {Host, Slider} from '@expo/ui/jetpack-compose';
import {
  semantics,
  testID as testIDModifier,
} from '@expo/ui/jetpack-compose/modifiers';
import {useNativeTheme} from './useNativeTheme';
import type {NativeSliderProps} from './types';

/**
 * A Material 3 slider. Compose has no "drag started" callback, so the first
 * value change of a drag counts as the start, and `onValueChangeFinished`
 * as the end.
 */
export function NativeSlider({
  value,
  minimumValue = 0,
  maximumValue = 1,
  step,
  disabled,
  onValueChange,
  onSlidingStart,
  onSlidingComplete,
  thumbOnlyWhileSliding,
  accessibilityLabel,
  style,
  testID,
}: NativeSliderProps) {
  const native = useNativeTheme();
  const [sliding, setSliding] = useState(false);
  const slidingRef = useRef(false);
  const lastValue = useRef(value);
  if (!slidingRef.current) lastValue.current = value;

  const steps =
    step && step > 0
      ? Math.max(0, Math.round((maximumValue - minimumValue) / step) - 1)
      : 0;
  const modifiers = [];
  if (accessibilityLabel) {
    modifiers.push(semantics({contentDescription: accessibilityLabel}));
  }
  if (testID) modifiers.push(testIDModifier(testID));

  return (
    <Host
      matchContents={{vertical: true}}
      colorScheme={native.colorScheme}
      layoutDirection="leftToRight"
      style={style}>
      <Slider
        value={value}
        min={minimumValue}
        max={maximumValue}
        steps={steps}
        enabled={!disabled}
        colors={{
          activeTrackColor: native.tint,
          inactiveTrackColor: native.sliderTrack,
          thumbColor:
            thumbOnlyWhileSliding && !sliding ? 'transparent' : native.tint,
          activeTickColor: 'transparent',
          inactiveTickColor: 'transparent',
        }}
        modifiers={modifiers}
        onValueChange={next => {
          if (!slidingRef.current) {
            slidingRef.current = true;
            setSliding(true);
            onSlidingStart?.();
          }
          lastValue.current = next;
          onValueChange?.(next);
        }}
        onValueChangeFinished={() => {
          slidingRef.current = false;
          setSliding(false);
          onSlidingComplete?.(lastValue.current);
        }}
      />
    </Host>
  );
}
