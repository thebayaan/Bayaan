// @ai-generated
import {useEffect, useRef} from 'react';
import {useRoute} from 'expo-router';
import {useMushafNavigationStore} from '@/store/mushafNavigationStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {useMushafWordFlashStore} from '@/store/mushafWordFlashStore';
import {selectionForAnchor} from '@/services/mushaf/MushafVerseMapService';
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
 * 3 s, as for Similar Verses.
 *
 * A Quran search hit handed to the open reader (hooks/useOpenQuranHit.ts)
 * comes the same way, with the anchor of its first matched word and the
 * words to flash: as when a hit opens the reader (MushafReader), the shown
 * rewayah's verse holding that word is selected (not every verse holding
 * its Hafs verse), and the words flash. When no verse can be named (the
 * shown verse units are still being built, or the word is in the unnumbered
 * Fatiha basmala), the Hafs verse is selected, as there.
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
    const {page, surahId, verseKey, anchor, words} = resolveTarget(params);
    const unitSelection = anchor ? selectionForAnchor(anchor) : null;
    useMushafNavigationStore
      .getState()
      .navigateToPage(page, surahId, unitSelection ? undefined : verseKey);
    if (unitSelection) {
      useMushafVerseSelectionStore
        .getState()
        .selectUnits(unitSelection.rewayah, unitSelection.units, page);
    }
    if (verseKey && words?.length) {
      useMushafWordFlashStore.getState().show(verseKey, words);
    }
  }, [route.params, ready, params]);
}
