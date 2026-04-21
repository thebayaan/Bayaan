/**
 * useMushafAutoPageTurn
 *
 * Watches the mushaf player's current verse key during playback.
 * When the active ayah crosses a page boundary, triggers an animated
 * FlatList scroll to the new page.
 */

import {useEffect, useRef} from 'react';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';

export function useMushafAutoPageTurn(
  currentPage: number,
  navigateToPage: (page: number) => void,
  navigateToVerse?: (verseKey: string) => void,
) {
  const playbackState = useMushafPlayerStore(s => s.playbackState);
  const currentVerseKey = useMushafPlayerStore(s => s.currentVerseKey);
  const lastNavigatedPage = useRef<number>(currentPage);

  // Keep the ref in sync when the user manually scrolls
  useEffect(() => {
    lastNavigatedPage.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    if (playbackState !== 'playing' || !currentVerseKey) return;

    // In verse-level navigation mode (vertical/list view), scroll to every ayah
    if (navigateToVerse) {
      navigateToVerse(currentVerseKey);
      // Still keep page ref in sync
      const targetPage =
        digitalKhattDataService.getPageForVerse(currentVerseKey);
      if (targetPage) lastNavigatedPage.current = targetPage;
      return;
    }

    const targetPage = digitalKhattDataService.getPageForVerse(currentVerseKey);
    if (!targetPage) return;

    // Only navigate if the target page differs from the last navigated page
    if (targetPage !== lastNavigatedPage.current) {
      lastNavigatedPage.current = targetPage;
      navigateToPage(targetPage);
    }
  }, [playbackState, currentVerseKey, navigateToPage, navigateToVerse]);
}
