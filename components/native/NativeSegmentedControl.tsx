// @ai-generated
import React from 'react';
import {Platform, type StyleProp, type ViewStyle} from 'react-native';
import Color from 'color';
import SegmentedControl from '@expo/ui/community/segmented-control';
import {useNativeTheme} from './useNativeTheme';

interface NativeSegmentedControlProps {
  values: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The system segmented control: SwiftUI's segmented picker on iOS and
 * Material 3 segmented buttons on Android. It follows the reading theme's
 * light or dark mode rather than the system's.
 */
export function NativeSegmentedControl({
  values,
  selectedIndex,
  onChange,
  accessibilityLabel,
  style,
  testID,
}: NativeSegmentedControlProps) {
  const native = useNativeTheme();
  return (
    <SegmentedControl
      values={values}
      selectedIndex={selectedIndex}
      onChange={event => onChange(event.nativeEvent.selectedSegmentIndex)}
      appearance={native.colorScheme}
      // Material fills the selected segment with the wallpaper color by
      // default; keep it monochrome. iOS keeps its system thumb.
      tintColor={
        Platform.OS === 'android'
          ? Color(native.text).alpha(0.12).toString()
          : undefined
      }
      accessibilityLabel={accessibilityLabel}
      style={style}
      testID={testID}
    />
  );
}
