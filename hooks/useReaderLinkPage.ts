// @ai-generated
import {useEffect, useRef} from 'react';
import {useRoute} from 'expo-router';
import {useMushafNavigationStore} from '@/store/mushafNavigationStore';
import {
  resolveTarget,
  type MushafOpenParams,
} from '@/hooks/useMushafOpenTarget';

/**
 * A link to the open Mushaf reader gives its route new params but mounts no
 * new reader: a warm bayaan://mushaf?page=N navigates to the route on top,
 * and a link route pops back to it (components/mushaf/ReaderLinkRedirect.tsx).
 * MushafViewer reads its page only when it mounts, and the screen flashes
 * only the verse it opened on, so send the viewer the page of each later
 * link, with the link's verse: the viewer selects it and clears it after
 * 3 s, as for Similar Verses. A link names no stored anchor (only an in-app
 * push does, and a push mounts a new reader).
 *
 * The route's params object is compared, not the page: a second link to the
 * same page after the reader turned away moves the reader back. While the
 * reader is not `ready`, the viewer is not mounted yet: it mounts on the
 * page of the latest params by itself.
 */
export function useReaderLinkPage(
  params: MushafOpenParams,
  ready: boolean,
): void {
  const route = useRoute();
  const handled = useRef(route.params);
  useEffect(() => {
    if (route.params === handled.current) return;
    handled.current = route.params;
    if (!ready) return;
    const {page, surahId, verseKey} = resolveTarget(params);
    useMushafNavigationStore.getState().navigateToPage(page, surahId, verseKey);
  }, [route.params, ready, params]);
}
