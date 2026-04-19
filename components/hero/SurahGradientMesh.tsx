import React, {useId} from 'react';
import {StyleSheet} from 'react-native';
import Svg, {
  Defs,
  RadialGradient as SvgRadialGradient,
  Stop,
  Rect,
} from 'react-native-svg';

// Shared gradient-mesh palettes used by the surah hero and grid cards
// so both surfaces read with the same visual vocabulary.
export const MESH_PALETTES = [
  // Purple dream
  ['#e879f9', '#a78bfa', '#38bdf8', '#34d399'],
  // Ocean depths
  ['#38bdf8', '#818cf8', '#5eead4', '#a78bfa'],
  // Golden hour
  ['#fbbf24', '#fb923c', '#f87171', '#e879f9'],
  // Rose garden
  ['#f9a8d4', '#fb7185', '#a78bfa', '#38bdf8'],
  // Emerald forest
  ['#34d399', '#86efac', '#38bdf8', '#a78bfa'],
  // Twilight
  ['#a5b4fc', '#c4b5fd', '#f9a8d4', '#5eead4'],
] as const;

export type MeshPalette = (typeof MESH_PALETTES)[number];

export function paletteForSurah(surahId: number): MeshPalette {
  return MESH_PALETTES[(surahId - 1) % MESH_PALETTES.length];
}

interface SurahGradientMeshProps {
  palette: MeshPalette | readonly string[];
  isDark: boolean;
  // Optional viewBox; defaults to the hero's aspect ratio. Callers
  // with different aspect ratios can override without it affecting
  // the blob positions (they're % based).
  viewBoxWidth?: number;
  viewBoxHeight?: number;
}

/**
 * Four soft radial-gradient blobs laid over a transparent background.
 * Each blob has a unique id (via useId) so multiple meshes can coexist
 * on one screen without gradient-id collisions.
 */
export function SurahGradientMesh({
  palette,
  isDark,
  viewBoxWidth = 400,
  viewBoxHeight = 155,
}: SurahGradientMeshProps): React.ReactElement {
  const uid = useId();
  const id = (n: number): string => `bayaan-mesh-${uid}-${n}`;

  const mainOpacity = isDark ? 0.12 : 0.15;
  const tertiaryOpacity = isDark ? 0.08 : 0.1;
  const quaternaryOpacity = isDark ? 0.06 : 0.08;

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      preserveAspectRatio="xMidYMid slice">
      <Defs>
        <SvgRadialGradient id={id(1)} cx="0.2" cy="0.3" r="0.35">
          <Stop offset="0" stopColor={palette[0]} stopOpacity={mainOpacity} />
          <Stop offset="1" stopColor={palette[0]} stopOpacity={0} />
        </SvgRadialGradient>
        <SvgRadialGradient id={id(2)} cx="0.75" cy="0.7" r="0.3">
          <Stop offset="0" stopColor={palette[1]} stopOpacity={mainOpacity} />
          <Stop offset="1" stopColor={palette[1]} stopOpacity={0} />
        </SvgRadialGradient>
        <SvgRadialGradient id={id(3)} cx="0.55" cy="0.2" r="0.25">
          <Stop
            offset="0"
            stopColor={palette[2]}
            stopOpacity={tertiaryOpacity}
          />
          <Stop offset="1" stopColor={palette[2]} stopOpacity={0} />
        </SvgRadialGradient>
        <SvgRadialGradient id={id(4)} cx="0.35" cy="0.8" r="0.2">
          <Stop
            offset="0"
            stopColor={palette[3]}
            stopOpacity={quaternaryOpacity}
          />
          <Stop offset="1" stopColor={palette[3]} stopOpacity={0} />
        </SvgRadialGradient>
      </Defs>
      <Rect
        x="0"
        y="0"
        width={viewBoxWidth}
        height={viewBoxHeight}
        fill={`url(#${id(1)})`}
      />
      <Rect
        x="0"
        y="0"
        width={viewBoxWidth}
        height={viewBoxHeight}
        fill={`url(#${id(2)})`}
      />
      <Rect
        x="0"
        y="0"
        width={viewBoxWidth}
        height={viewBoxHeight}
        fill={`url(#${id(3)})`}
      />
      <Rect
        x="0"
        y="0"
        width={viewBoxWidth}
        height={viewBoxHeight}
        fill={`url(#${id(4)})`}
      />
    </Svg>
  );
}
