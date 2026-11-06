// @ai-generated
import React, {useRef} from 'react';
import {Host, Slider} from '@expo/ui/swift-ui';
import {
  accessibilityLabel as a11yLabel,
  disabled as disabledModifier,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import {useNativeTheme} from './useNativeTheme';
import type {NativeSliderProps} from './types';

/**
 * A SwiftUI slider. SwiftUI reports drags through `onEditingChanged`, which
 * becomes `onSlidingStart` / `onSlidingComplete` here so the scrubbers keep
 * their seek-on-release behaviour.
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
  accessibilityLabel,
  style,
  testID,
}: NativeSliderProps) {
  const native = useNativeTheme();
  const lastValue = useRef(value);
  lastValue.current = value;

  const modifiers = [tint(native.tint)];
  if (disabled) modifiers.push(disabledModifier(true));
  if (accessibilityLabel) modifiers.push(a11yLabel(accessibilityLabel));

  return (
    <Host
      matchContents={{vertical: true}}
      colorScheme={native.colorScheme}
      // Sliders run left to right in every language (utils/rtl forceLTR).
      layoutDirection="leftToRight"
      style={style}>
      <Slider
        value={value}
        min={minimumValue}
        max={maximumValue}
        step={step && step > 0 ? step : undefined}
        modifiers={modifiers}
        testID={testID}
        onValueChange={next => {
          lastValue.current = next;
          onValueChange?.(next);
        }}
        onEditingChanged={isEditing => {
          if (isEditing) onSlidingStart?.();
          else onSlidingComplete?.(lastValue.current);
        }}
      />
    </Host>
  );
}
