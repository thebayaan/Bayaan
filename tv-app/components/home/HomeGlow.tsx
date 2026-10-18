import React from 'react';
import {Animated, StyleSheet} from 'react-native';
import Svg, {Defs, Ellipse, RadialGradient, Stop} from 'react-native-svg';

type Props = {
  /** One to three colours; the first is the main pool behind the art. */
  palette: readonly string[];
  /** Home fades the glow out once the hero has scrolled away. */
  opacity?: Animated.Value;
};

// Pools in a 100x100 viewBox stretched over the screen: the main one behind
// the hero's calligraphy (top right), softer ones bleeding left and down so
// the rails below sit on plain ink, as in the approved Home.
const POOLS = [
  {cx: 74, cy: 18, rx: 42, ry: 52, opacity: 0.42},
  {cx: 92, cy: 44, rx: 26, ry: 32, opacity: 0.22},
  {cx: 48, cy: 4, rx: 30, ry: 26, opacity: 0.14},
] as const;

/**
 * Home's background: a soft glow taken from the hero's surah or adhkar
 * colour, fading into ink. Static, so a screen left on stays calm; it only
 * fades (opacity) as the hero it belongs to scrolls away.
 */
export function HomeGlow({palette, opacity}: Props): React.ReactElement {
  const colorAt = (i: number): string =>
    palette[i] ?? palette[palette.length - 1] ?? '#000000';
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, opacity ? {opacity} : null]}
      pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none">
        <Defs>
          {POOLS.map((pool, i) => (
            <RadialGradient
              key={i}
              id={`home-glow-${i}`}
              cx="50%"
              cy="50%"
              r="50%">
              <Stop
                offset="0"
                stopColor={colorAt(i)}
                stopOpacity={pool.opacity}
              />
              <Stop offset="1" stopColor={colorAt(i)} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {POOLS.map((pool, i) => (
          <Ellipse
            key={i}
            cx={pool.cx}
            cy={pool.cy}
            rx={pool.rx}
            ry={pool.ry}
            fill={`url(#home-glow-${i})`}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}
