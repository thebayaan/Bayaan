// @ai-generated
/**
 * The app's back, share and search glyphs, so each looks the same on every
 * screen: SF Symbols on iOS, the Mushaf's icons on Android. Back always
 * points left; callers keep flipping it for right-to-left (`flipX`).
 */

import React from 'react';
import {Platform, type StyleProp, type ViewStyle} from 'react-native';
import {SymbolView} from 'expo-symbols';
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

export function ShareIcon({
  size,
  color,
  style,
}: ActionIconProps): React.JSX.Element {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name="square.and.arrow.up"
        size={size}
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
