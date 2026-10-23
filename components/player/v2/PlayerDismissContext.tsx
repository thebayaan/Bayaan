// @ai-generated
import React, {createContext, useContext, useMemo} from 'react';
import type {ScrollViewProps, View} from 'react-native';
import {Gesture, type PanGesture} from 'react-native-gesture-handler';
import type {SharedValue} from 'react-native-reanimated';
import type {PlayerRect} from '@/services/player/sheetRef';

/**
 * Lets the full player's artwork be the landing spot of the flying artwork.
 * Only the morphing surface supplies it.
 */
export interface PlayerArtworkFlight {
  /** Morph progress, 0 = mini player, 1 = full screen. */
  progress: SharedValue<number>;
  /** The full-screen content view; target rects are relative to it. */
  contentRef: React.RefObject<View | null>;
  /** Report (or clear, with null) where the artwork sits when open. */
  setTarget: (rect: PlayerRect | null) => void;
}

/**
 * What the player content needs from whichever container hosts it (the gorhom
 * sheet or the morphing PlayerSurface): a drag-to-dismiss gesture for the
 * header and controls cards, and a scroll component for the Mushaf / queue
 * lists that hands a downward drag at the top of the list to the dismiss.
 *
 * Keeping this behind a context lets PlayerContent, TabletPlayer and the
 * tablet controls column stay unaware of which container is active.
 */
export interface PlayerDismissApi {
  /** Builds a fresh pan gesture; each GestureDetector gets its own. */
  createDismissGesture: () => PanGesture;
  /** FlashList `renderScrollComponent`; undefined = plain native scroll. */
  renderScrollComponent?:
    | React.ComponentType<ScrollViewProps>
    | React.FC<ScrollViewProps>;
  artworkFlight?: PlayerArtworkFlight;
}

const noopApi: PlayerDismissApi = {
  createDismissGesture: () => Gesture.Pan().enabled(false),
};

const PlayerDismissContext = createContext<PlayerDismissApi>(noopApi);

export const PlayerDismissProvider = PlayerDismissContext.Provider;

export function usePlayerDismissApi(): PlayerDismissApi {
  return useContext(PlayerDismissContext);
}

/** Drag-to-dismiss pan for one GestureDetector. */
export function usePlayerDismissGesture(): PanGesture {
  const {createDismissGesture} = usePlayerDismissApi();
  return useMemo(() => createDismissGesture(), [createDismissGesture]);
}
