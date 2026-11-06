// @ai-generated
import React from 'react';
import {Host, Toggle} from '@expo/ui/swift-ui';
import {
  accessibilityLabel as a11yLabel,
  disabled as disabledModifier,
  labelsHidden,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import {useNativeTheme} from './useNativeTheme';
import type {NativeSwitchProps} from './types';

/** A SwiftUI toggle tinted like the rest of the chrome. */
export function NativeSwitch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
  style,
  testID,
}: NativeSwitchProps) {
  const native = useNativeTheme();
  const modifiers = [labelsHidden(), tint(native.trackOn)];
  if (disabled) modifiers.push(disabledModifier(true));
  if (accessibilityLabel) modifiers.push(a11yLabel(accessibilityLabel));
  return (
    <Host
      matchContents
      colorScheme={native.colorScheme}
      layoutDirection={native.layoutDirection}
      style={style}>
      <Toggle
        isOn={value}
        onIsOnChange={onValueChange}
        label=""
        modifiers={modifiers}
        testID={testID}
      />
    </Host>
  );
}
