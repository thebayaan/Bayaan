// @ai-generated
import React from 'react';
import {View} from 'react-native';
import type {NativeMenuProps} from './menuTypes';

/**
 * Web has no native menu. Callers check `nativeMenusAvailable` and keep
 * their sheet there, so this only draws the trigger.
 */
export function NativeMenu({style, testID, children}: NativeMenuProps) {
  return (
    <View style={style} testID={testID}>
      {children}
    </View>
  );
}
