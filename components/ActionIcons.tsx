// @ai-generated
/**
 * The app's back, share, search and reader options glyphs, so each looks the
 * same on every screen: SF Symbols on iOS, the Mushaf's icons on Android. Back
 * always points left; callers keep flipping it for right-to-left (`flipX`).
 */

import React from 'react';
import {Platform, type StyleProp, type ViewStyle} from 'react-native';
import {SymbolView} from 'expo-symbols';
import Svg, {Circle, Path} from 'react-native-svg';
import {Feather, Ionicons} from '@expo/vector-icons';

interface ActionIconProps {
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}

/** iOS: chevron.backward (drawn as chevron.left so `flipX` stays the one flip). */
export function BackIcon({
  size,
  color,
  style,
}: ActionIconProps): React.JSX.Element {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name="chevron.left"
        size={size}
        tintColor={color}
        weight="medium"
        style={style}
      />
    );
  }
  return (
    <Ionicons name="chevron-back" size={size} color={color} style={style} />
  );
}

/** See ShareIcon. @ai */
const SHARE_GLYPH_SCALE = 1.2;

export function ShareIcon({
  size,
  color,
  style,
}: ActionIconProps): React.JSX.Element {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name="square.and.arrow.up"
        // @ai: SymbolView fits the glyph inside a size×size box, and this
        // one is much taller than it is wide (box plus arrow), so at the
        // other icons' box it drew about a fifth smaller than iOS's own
        // share button. A box 1.2× as large matches the system bar's glyph.
        size={size * SHARE_GLYPH_SCALE}
        tintColor={color}
        weight="medium"
        style={style}
      />
    );
  }
  return <Feather name="share" size={size} color={color} style={style} />;
}

export function SearchIcon({
  size,
  color,
  style,
}: ActionIconProps): React.JSX.Element {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name="magnifyingglass"
        size={size}
        tintColor={color}
        weight="medium"
        style={style}
      />
    );
  }
  return <Feather name="search" size={size} color={color} style={style} />;
}

/** iOS: two lines and two rings, from Lucide's settings-2 (ISC license). */
export function ReaderOptionsIcon({
  size,
  color,
  style,
}: ActionIconProps): React.JSX.Element {
  if (Platform.OS === 'ios') {
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}>
        <Path d="M20 7h-9" />
        <Path d="M14 17H5" />
        <Circle cx={17} cy={17} r={3} />
        <Circle cx={7} cy={7} r={3} />
      </Svg>
    );
  }
  return (
    <Ionicons name="options-outline" size={size} color={color} style={style} />
  );
}
