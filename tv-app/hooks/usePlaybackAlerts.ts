import {useEffect} from 'react';
import {isNetworkError, useTVPlayerStore} from '../store/tvPlayerStore';
import {useNavStore} from '../store/navStore';
import {showToast} from '../store/toastStore';

/**
 * The player shows its own error banner, but playback carries on after the
 * player is closed (the next surah loading, say). When it fails there, a toast
 * says so, and the sidebar tile shows the error until it is retried.
 */
export function usePlaybackAlerts(): void {
  useEffect(
    () =>
      useTVPlayerStore.subscribe((state, prev) => {
        if (state.status !== 'error' || prev.status === 'error') return;
        const {stack} = useNavStore.getState();
        if (stack[stack.length - 1]?.screen === 'nowPlaying') return;
        const title = state.queue[state.currentIndex]?.title;
        const what = title ? `Couldn't play ${title}` : "Couldn't play";
        showToast(
          isNetworkError(state.lastError)
            ? `${what}: you're offline. Open the player to try again.`
            : `${what}. Open the player to try again.`,
          'error',
        );
      }),
    [],
  );
}
