import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {colors} from '../../theme/colors';
import {scale} from '../../theme/scale';

/**
 * Ink fading out over the top of the Settings list, so rows scrolled up
 * under the page title melt away instead of being cut off at its edge.
 * Never takes touches or focus.
 */
export function ListFade({height}: {height: number}): React.ReactElement {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={[styles.wrap, {height: scale(height)}]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="settings-list-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="url(#settings-list-fade)"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {position: 'absolute', left: 0, right: 0, top: 0},
});
