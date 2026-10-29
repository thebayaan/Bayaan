import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {colors} from '../../theme/colors';
import {scale} from '../../theme/scale';

/**
 * Ink fading in over the bottom of the shelf, so the next row reads as
 * "more below" rather than a cut-off. Never takes touches or focus.
 */
export function ShelfFade({height}: {height: number}): React.ReactElement {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={[styles.wrap, {height: scale(height)}]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="lib-shelf-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
            <Stop
              offset="0.55"
              stopColor={colors.background}
              stopOpacity={0.9}
            />
            <Stop offset="0.85" stopColor={colors.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="url(#lib-shelf-fade)"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {position: 'absolute', left: 0, right: 0, bottom: 0},
});
