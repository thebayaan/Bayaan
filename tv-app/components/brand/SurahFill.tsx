import React from 'react';
import {StyleSheet} from 'react-native';
import Svg, {Defs, RadialGradient, Rect, Stop} from 'react-native-svg';
import {GradientFill} from './GradientFill';
import {
  SURAH_CARD_STYLE,
  SURAH_GLOW_BLOBS,
  surahGlow,
  surahGradient,
} from '../../theme/surahColors';

type Props = {
  surahNumber: number;
  /** Gradient id prefix, unique per screen (SVG ids are document-wide). */
  id: string;
};

/**
 * A surah card's background, the phone's surah card look: deep ink with the
 * surah's four soft colour glows (components/hero/SurahGradientMesh), at the
 * strength theme/surahColors sets for the TV. Fills its parent, which sets
 * size, radius and clipping.
 */
export function SurahFill({surahNumber, id}: Props): React.ReactElement {
  const style = SURAH_CARD_STYLE;
  if (style.kind === 'pigment') {
    return <GradientFill colors={surahGradient(surahNumber)} id={id} />;
  }
  const palette = surahGlow(surahNumber);
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      preserveAspectRatio="none">
      <Defs>
        {SURAH_GLOW_BLOBS.map((blob, i) => (
          <RadialGradient
            key={i}
            id={`${id}-${i}`}
            cx={blob.cx}
            cy={blob.cy}
            r={blob.r}>
            <Stop
              offset="0"
              stopColor={palette[i]}
              stopOpacity={style.opacity[blob.strength]}
            />
            <Stop offset="1" stopColor={palette[i]} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={style.base} />
      {SURAH_GLOW_BLOBS.map((_, i) => (
        <Rect
          key={i}
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill={`url(#${id}-${i})`}
        />
      ))}
    </Svg>
  );
}
