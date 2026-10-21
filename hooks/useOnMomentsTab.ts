// @ai-start
import {useSegments} from 'expo-router';
import {usePlayerStore} from '@/services/player/store/playerStore';

/** True while the Moments tab is the focused tab, on any of its screens. */
export function useOnMomentsTab(): boolean {
  const segments = useSegments() as string[];
  return segments[0] === '(tabs)' && segments[1] === '(d.moments)';
}

/**
 * True only while the Moments feed itself is on screen. A screen pushed in
 * the Moments stack, such as a reciter profile, is in the tab but not the
 * feed, so the feed pauses and the normal chrome comes back.
 */
export function useOnMomentsFeed(): boolean {
  const segments = useSegments() as string[];
  return (
    segments[0] === '(tabs)' &&
    segments[1] === '(d.moments)' &&
    (segments[2] === undefined || segments[2] === 'index')
  );
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
  const onFeed = useOnMomentsFeed();
  const mainActive = useMainPlayerActive();
  return onFeed && !mainActive;
}
// @ai-end
