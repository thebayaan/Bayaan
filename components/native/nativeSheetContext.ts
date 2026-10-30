// @ai-generated
import {createContext, useContext} from 'react';

/**
 * The id of the native sheet a component is rendered in, or null when it
 * is on react-native-actions-sheet. `AdaptiveActionSheet` reads it to draw
 * its content without the library sheet around it.
 */
export const NativeSheetLevelContext = createContext<string | null>(null);

export function useNativeSheetId(): string | null {
  return useContext(NativeSheetLevelContext);
}
