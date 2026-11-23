// @ai-generated
import React from 'react';
import {Switch} from 'react-native';
import {useNativeTheme} from './useNativeTheme';
import type {NativeSwitchProps} from './types';

/** Web and test fallback: the React Native switch in the same colors. */
export function NativeSwitch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
  style,
  testID,
}: NativeSwitchProps) {
  const native = useNativeTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{false: native.trackOff, true: native.trackOn}}
      thumbColor="#FFFFFF"
      ios_backgroundColor={native.trackOff}
      style={style}
      testID={testID}
    />
  );
}
