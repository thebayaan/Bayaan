import React from 'react';
import {StyleSheet} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

type Props = {
  colors: readonly [string, string];
  /** Gradient id, unique per screen (SVG ids are document-wide on some platforms). */
  id: string;
};

/**
 * Fills its parent with a 135-degree two-stop gradient, the look of the
 * mobile app's surah tiles. Drawn with react-native-svg because the TV app has
 * no gradient view; the parent sets size, radius and `overflow: 'hidden'`.
 */
export function GradientFill({colors, id}: Props): React.ReactElement {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors[0]} />
          <Stop offset="1" stopColor={colors[1]} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
