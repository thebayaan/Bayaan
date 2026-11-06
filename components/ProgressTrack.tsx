// @ai-generated
import React from 'react';
import {View, type StyleProp, type ViewStyle} from 'react-native';
import {moderateScale} from '@/utils/scale';

interface ProgressTrackProps {
  /** Progress from 0 to 1. */
  value: number;
  fillColor: string;
  trackColor: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A read-only progress bar. The home cards used a disabled slider with a
 * hidden thumb for this; a plain bar needs no slider package and no host.
 */
export function ProgressTrack({
  value,
  fillColor,
  trackColor,
  style,
  testID,
}: ProgressTrackProps) {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const height = moderateScale(3);
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{min: 0, max: 100, now: Math.round(clamped * 100)}}
      style={[{justifyContent: 'center'}, style]}>
      <View
        style={{
          height,
          borderRadius: moderateScale(2),
          backgroundColor: trackColor,
          overflow: 'hidden',
        }}>
        <View
          style={{
            width: `${clamped * 100}%`,
            height,
            backgroundColor: fillColor,
          }}
        />
      </View>
    </View>
  );
}
