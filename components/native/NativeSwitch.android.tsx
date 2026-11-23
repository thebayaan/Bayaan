// @ai-generated
import React from 'react';
import Color from 'color';
import {Host, Switch} from '@expo/ui/jetpack-compose';
import {
  semantics,
  testID as testIDModifier,
} from '@expo/ui/jetpack-compose/modifiers';
import {useNativeTheme} from './useNativeTheme';
import type {NativeSwitchProps} from './types';

/** A Material 3 switch in the monochrome palette. */
export function NativeSwitch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
  style,
  testID,
}: NativeSwitchProps) {
  const native = useNativeTheme();
  const muted = Color(native.text).alpha(0.45).toString();
  const modifiers = [];
  if (accessibilityLabel) {
    modifiers.push(semantics({contentDescription: accessibilityLabel}));
  }
  if (testID) modifiers.push(testIDModifier(testID));
  return (
    <Host
      matchContents
      colorScheme={native.colorScheme}
      layoutDirection={native.layoutDirection}
      style={style}>
      <Switch
        value={value}
        onCheckedChange={onValueChange}
        enabled={!disabled}
        colors={{
          checkedTrackColor: native.trackOn,
          checkedThumbColor: '#FFFFFF',
          checkedBorderColor: 'transparent',
          uncheckedTrackColor: native.trackOff,
          uncheckedThumbColor: muted,
          uncheckedBorderColor: muted,
        }}
        modifiers={modifiers}
      />
    </Host>
  );
}
