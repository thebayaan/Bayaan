// @ai-generated
import {useEffect} from 'react';
import {useNetworkStore} from '@/store/networkStore';
import {
  isConnectionPlaybackError,
  useMushafPlayerStore,
} from '@/store/mushafPlayerStore';

/**
 * Picks up a start that was refused for lack of a connection once the
 * connection returns, while the refusal is still on screen.
 */
export function usePlaybackRetryOnReconnect(): void {
  useEffect(
    () =>
      useNetworkStore.subscribe((state, prev) => {
        if (!state.isOnline || prev.isOnline) return;
        const player = useMushafPlayerStore.getState();
        if (isConnectionPlaybackError(player.timestampError)) {
          player.retryPlayback();
        }
      }),
    [],
  );
}
