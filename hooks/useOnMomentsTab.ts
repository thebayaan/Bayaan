// @ai-start
import {useLayoutEffect} from 'react';
import {useSegments} from 'expo-router';
import {create} from 'zustand';
import {usePlayerStore} from '@/services/player/store/playerStore';

// Whether Moments is the focused tab, kept in a store so screens re-render
// only when it changes, not on every navigation like `useSegments` does.
const useMomentsTabStore = create<{onMoments: boolean}>(() => ({
  onMoments: false,
}));

/**
 * Follows the route segments and writes the Moments focus to the store.
 * Rendered once, in the tabs layout. Native tabs don't fire focus events
 * reliably, so this is the one place that listens to every navigation.
 */
export function MomentsTabTracker(): null {
  const segments = useSegments() as string[];
  const onMoments = segments[0] === '(tabs)' && segments[1] === '(d.moments)';
  useLayoutEffect(() => {
    useMomentsTabStore.setState({onMoments});
  }, [onMoments]);
  return null;
}

/** True while the Moments tab is the focused tab. */
export function useOnMomentsTab(): boolean {
  return useMomentsTabStore(s => s.onMoments);
}

/** Whether the main player is playing, e.g. after Continue from a moment. */
export function useMainPlayerActive(): boolean {
  return usePlayerStore(
    s => s.playback.state === 'playing' || s.playback.state === 'buffering',
  );
}

/**
 * Moments hides the mini player while its own feed is in charge, and shows
 * it again when the main player is playing so it is clear what's on.
 */
export function useHideMiniPlayerOnMoments(): boolean {
  const onMoments = useOnMomentsTab();
  const mainActive = useMainPlayerActive();
  return onMoments && !mainActive;
}
// @ai-end
