// @ai-generated
import React, {createContext, useContext, useMemo} from 'react';
import type {ScrollViewProps} from 'react-native';
import {Gesture, type LegacyPanGesture} from 'react-native-gesture-handler';

/**
 * What the player content needs from the container hosting it (the morphing
 * PlayerSurface): a drag-to-dismiss gesture for the header and controls
 * cards, and a scroll component for the Mushaf / queue lists that hands a
 * downward drag at the top of the list to the dismiss.
 *
 * Keeping this behind a context lets PlayerContent and the iPad player
 * render outside a player (no-op gesture) too.
 */
export interface PlayerDismissApi {
  /** Builds a fresh pan gesture; each GestureDetector gets its own. */
  createDismissGesture: () => LegacyPanGesture;
  /** FlashList `renderScrollComponent`; undefined = plain native scroll. */
  renderScrollComponent?:
    | React.ComponentType<ScrollViewProps>
    | React.FC<ScrollViewProps>;
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
export function usePlayerDismissGesture(): LegacyPanGesture {
  const {createDismissGesture} = usePlayerDismissApi();
  return useMemo(() => createDismissGesture(), [createDismissGesture]);
}
