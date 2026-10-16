import React from 'react';
import Svg, {Circle, Path} from 'react-native-svg';

type Props = {color: string; size: number};

/** A clock face, for recent searches. */
export function ClockGlyph({color, size}: Props): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.9} />
      <Path
        d="M12 7.5V12l3 2"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** A magnifier, for suggestions (lighter than the shared SearchIcon). */
export function MagnifierGlyph({color, size}: Props): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={2} />
      <Path
        d="M20 20l-4.2-4.2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Two open hands, for adhkar. */
export function HandsGlyph({color, size}: Props): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 20c-2-1.5-3-3.6-3-6V8.5a1.5 1.5 0 0 1 3 0V12M16 20c2-1.5 3-3.6 3-6V8.5a1.5 1.5 0 0 0-3 0V12M8 12l1.6-6.4a1.3 1.3 0 0 1 2.4.5V13M16 12l-1.6-6.4a1.3 1.3 0 0 0-2.4.5"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
