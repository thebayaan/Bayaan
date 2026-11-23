// @ai-generated
import {useEffect, useRef} from 'react';
import {useRoute} from 'expo-router';
import {useMushafNavigationStore} from '@/store/mushafNavigationStore';
import {
  SELECTION_FLASH_MS,
  flashedSelectionClearer,
  useMushafVerseSelectionStore,
} from '@/store/mushafVerseSelectionStore';
import {useMushafWordFlashStore} from '@/store/mushafWordFlashStore';
import {selectionForAnchor} from '@/services/mushaf/MushafVerseMapService';
import {
  resolveTarget,
  type MushafOpenParams,
} from '@/hooks/useMushafOpenTarget';

/**
 * A link to the open Mushaf reader gives its route new params but mounts no
 * new reader: a link route pops back to it
 * (components/mushaf/ReaderLinkRedirect.tsx), and app/+native-intent.tsx
 * sends a warm bayaan://mushaf?page=N through a link route too.
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
  // The viewer ends the flash of a verse it is sent. A verse selected here
  // is not sent to it, so that flash ends here. One timer, cleared on
  // unmount (not when the effect below re-runs: it does on every render).
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current !== null) clearTimeout(flashTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (route.params === handled.current) return;
    handled.current = route.params;
    if (!ready) return;
    const {page, surahId, verseKey, anchor, words} = resolveTarget(params);
    const unitSelection = anchor ? selectionForAnchor(anchor) : null;
    useMushafNavigationStore.getState().navigateTo({
      page,
      surahId,
      verseKey: unitSelection ? undefined : verseKey,
    });
    if (unitSelection) {
      useMushafVerseSelectionStore
        .getState()
        .selectUnits(unitSelection.rewayah, unitSelection.units, page);
      // Ends only this flash: a verse the reader selects meanwhile stays.
      if (flashTimer.current !== null) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(
        flashedSelectionClearer(),
        SELECTION_FLASH_MS,
      );
    }
    if (verseKey && words?.length) {
      useMushafWordFlashStore.getState().show(verseKey, words);
    }
  }, [route.params, ready, params]);
}
