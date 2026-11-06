// @ai-generated
import {useContext} from 'react';
import {HeaderHeightContext} from 'expo-router/react-navigation';

/**
 * Height of the native (glass) Stack header that content must clear, or 0
 * when the screen draws its own header.
 *
 * Always reads the context, so it is safe to call unconditionally (unlike
 * `enabled ? useHeaderHeight() : 0`, which breaks the rules of hooks), and
 * returns 0 instead of throwing outside a navigator with a header.
 */
export function useGlassHeaderHeight(enabled: boolean): number {
  const height = useContext(HeaderHeightContext);
  return enabled ? (height ?? 0) : 0;
}
