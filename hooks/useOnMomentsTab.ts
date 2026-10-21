// @ai-start
import {useSegments} from 'expo-router';
import {usePlayerStore} from '@/services/player/store/playerStore';

/** True while the Moments tab is the focused tab. */
export function useOnMomentsTab(): boolean {
  const segments = useSegments() as string[];
  return segments[0] === '(tabs)' && segments[1] === '(d.moments)';
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
