// @ai-start
import {useSegments} from 'expo-router';

/** True while the Moments tab is the focused tab. */
export function useOnMomentsTab(): boolean {
  const segments = useSegments() as string[];
  return segments[0] === '(tabs)' && segments[1] === '(d.moments)';
}
// @ai-end
