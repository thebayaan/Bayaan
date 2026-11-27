// @ai-generated
import {createContext, useContext} from 'react';

/** The native sheet level a component is rendered in. */
export interface NativeSheetLevelInfo {
  id: string;
  key: number;
  /** The sheet is sized to its content, which reports its height. */
  fit: boolean;
  /** Registered as fitted; its body keeps the measuring layout. */
  fitted: boolean;
}

/**
 * The native sheet a component is rendered in, or null when it is on
 * react-native-actions-sheet. `AdaptiveActionSheet` reads it to draw its
 * content without the library sheet around it.
 */
export const NativeSheetLevelContext =
  createContext<NativeSheetLevelInfo | null>(null);

export function useNativeSheetLevel(): NativeSheetLevelInfo | null {
  return useContext(NativeSheetLevelContext);
}

export function useNativeSheetId(): string | null {
  return useContext(NativeSheetLevelContext)?.id ?? null;
}
