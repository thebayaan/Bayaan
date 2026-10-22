import {useCallback} from 'react';
import {useRouter, usePathname, useSegments} from 'expo-router';
import {usePlayerStore} from '@/services/player/store/playerStore';

// @ai-start
// Tabs whose stack has a `reciter/[id]` screen. Opening a profile from one of
// them stays in that tab; anywhere else falls back to Home.
const TABS_WITH_RECITER = [
  '(a.home)',
  '(b.search)',
  '(c.collection)',
  '(d.moments)',
] as const;
type ReciterTab = (typeof TABS_WITH_RECITER)[number];

/** The tab to open a reciter profile in, given the current route segments. */
export function reciterTabFor(segments: readonly string[]): ReciterTab {
  const tab = segments[0] === '(tabs)' ? segments[1] : undefined;
  return (TABS_WITH_RECITER as readonly string[]).includes(tab ?? '')
    ? (tab as ReciterTab)
    : '(a.home)';
}
// @ai-end

export const useReciterNavigation = () => {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments() as string[]; // @ai
  const setSheetMode = usePlayerStore(state => state.setSheetMode);

  const navigateToReciterProfile = useCallback(
    (reciterId: string) => {
      // Hide the player sheet first
      setSheetMode('hidden');

      // Skip navigation if already on this reciter's profile
      const alreadyOnReciter = pathname.endsWith(`/reciter/${reciterId}`);
      if (alreadyOnReciter) return;

      // @ai-start
      // Push within the current tab's stack so the user stays in that tab.
      const tab = reciterTabFor(segments);
      // Navigate after a short delay to allow the sheet to close
      setTimeout(() => {
        router.push({
          pathname: `/(tabs)/${tab}/reciter/[id]`,
          params: {id: reciterId},
        });
      }, 300); // Delay for bottom sheet animation
      // @ai-end
    },
    [router, pathname, segments, setSheetMode],
  );

  return {navigateToReciterProfile};
};
