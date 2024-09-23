import React from 'react';
import Svg, {Path} from 'react-native-svg';
import {surahPaths} from './surahPaths';

interface SurahNameSvgProps {
  surahNumber: number;
  width?: number;
  height?: number;
  color?: string;
}

function SurahNameSvg({
  surahNumber,
  width = 56,
  height = 56,
  color = '#000',
}: SurahNameSvgProps) {
  const pathData = surahPaths[surahNumber];

  return (
    <Svg width={width} height={height} viewBox="0 0 56 56">
      {pathData ? (
        <Path d={pathData} fill={color} />
      ) : (
        <Path d="M28 28h1v1h-1z" fill="#f00" /> // Red square as fallback
      )}
    </Svg>
  );
}

export default SurahNameSvg;
