import {useCallback} from 'react';
import {useNavigationContainerRef, useRouter} from 'expo-router';
import {
  quranHitOpenMethod,
  quranHitOpenParams,
} from '@/utils/search/quranHitParams';

/**
 * Opens a Quran search hit in the Mushaf on the page of its first matched
 * word, with the matched words flashed, from outside the reader: the Search
 * tab (and its recent searches) and root search in the verse sheet. One
 * reader at a time: when the root stack already holds the reader (the verse
 * sheet or the player was over it), the hit goes to that reader, which turns
 * to it as it does for a link (hooks/useReaderLinkPage.ts); otherwise the
 * hit pushes one (see quranHitOpenMethod). The mushaf search runs inside the
 * reader and moves it directly (MushafSearchView).
 */
export function useOpenQuranHit(): (
  verseKey: string,
  positions: readonly number[],
) => void {
  const router = useRouter();
  const navigation = useNavigationContainerRef();
  return useCallback(
    (verseKey: string, positions: readonly number[]) => {
      const params = quranHitOpenParams(verseKey, positions);
      const state = navigation.isReady()
        ? navigation.getRootState()
        : undefined;
      if (quranHitOpenMethod(state) === 'dismissTo') {
        router.dismissTo({pathname: '/mushaf', params});
      } else {
        router.push({pathname: '/mushaf', params});
      }
    },
    [router, navigation],
  );
}
