import React from 'react';
import Svg, {Path} from 'react-native-svg';

type IconProps = {color: string; size: number};

/**
 * A single chevron: one verse back (or 15 seconds when the recitation has no
 * verse timings). The skip-track glyphs are kept for previous/next surah.
 */
export function StepBackIcon({color, size}: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.5 5.5L8 12l6.5 6.5"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function StepForwardIcon({color, size}: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.5 5.5L16 12l-6.5 6.5"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
