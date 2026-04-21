import {useMemo} from 'react';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {Track} from '@/types/audio';
import {PlaybackSettings} from '@/services/player/types/state';

/**
 * Hook that returns ONLY action functions via getState().
 * No state subscription = zero re-renders from store changes.
 *
 * Use this in components that only need to call player actions
 * (e.g., play, pause, updateQueue) without reading any state.
 */
export function usePlayerActions() {
  return useMemo(
    () => ({
      play: () => usePlayerStore.getState().play(),
      pause: () => usePlayerStore.getState().pause(),
      skipToNext: () => usePlayerStore.getState().skipToNext(),
      skipToPrevious: () => usePlayerStore.getState().skipToPrevious(),
      seekTo: (position: number) => usePlayerStore.getState().seekTo(position),
      setRate: (rate: number) => usePlayerStore.getState().setRate(rate),

      updateQueue: (
        tracks: Track[],
        currentIndex?: number,
        startPosition?: number,
      ) =>
        usePlayerStore
          .getState()
          .updateQueue(tracks, currentIndex, startPosition),
      addToQueue: (tracks: Track[]) =>
        usePlayerStore.getState().addToQueue(tracks),
      removeFromQueue: (indices: number[]) =>
        usePlayerStore.getState().removeFromQueue(indices),
      moveInQueue: (fromIndex: number, toIndex: number) =>
        usePlayerStore.getState().moveInQueue(fromIndex, toIndex),

      setSheetMode: (mode: 'hidden' | 'full') =>
        usePlayerStore.getState().setSheetMode(mode),
      toggleImmersive: () => usePlayerStore.getState().toggleImmersive(),
      setImmersive: (value: boolean) =>
        usePlayerStore.getState().setImmersive(value),
      setRepeatMode: (mode: PlaybackSettings['repeatMode']) =>
        usePlayerStore.getState().setRepeatMode(mode),
      toggleShuffle: () => usePlayerStore.getState().toggleShuffle(),
      setSleepTimer: (minutes: number) =>
        usePlayerStore.getState().setSleepTimer(minutes),
      toggleSkipSilence: () => usePlayerStore.getState().toggleSkipSilence(),

      updateSettings: (settings: Partial<PlaybackSettings>) => {
        const state = usePlayerStore.getState();
        if ('repeatMode' in settings && settings.repeatMode !== undefined) {
          state.setRepeatMode(settings.repeatMode);
        }
        if ('shuffle' in settings) {
          state.toggleShuffle();
        }
        if ('sleepTimer' in settings && settings.sleepTimer !== undefined) {
          state.setSleepTimer(settings.sleepTimer as number);
        }
        if ('skipSilence' in settings) {
          state.toggleSkipSilence();
        }
      },
    }),
    [],
  );
}
