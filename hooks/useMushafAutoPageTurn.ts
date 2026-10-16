/**
 * useMushafAutoPageTurn
 *
 * Watches the mushaf player's current verse key during playback, or the
 * ayah being recited while recitation follow-along listens. When the active
 * ayah crosses a page boundary, triggers an animated FlatList scroll to the
 * new page.
 */

import {useEffect, useRef} from 'react';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {useRecitationTrackingStore} from '@/store/recitationTrackingStore';
import {
  dkWordPosition,
  lastWordOnPage,
} from '@/components/mushaf/skia/recitedWord';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';

export function useMushafAutoPageTurn(
  currentPage: number,
  navigateToPage: (page: number) => void,
  navigateToVerse?: (verseKey: string) => void,
) {
  const playbackState = useMushafPlayerStore(s => s.playbackState);
  const playerVerseKey = useMushafPlayerStore(s => s.currentVerseKey);
  const recitedVerseKey = useRecitationTrackingStore(s =>
    s.status === 'listening' ? s.verseKey : null,
  );
  const isFollowing = playbackState === 'playing' || recitedVerseKey !== null;
  const currentVerseKey = recitedVerseKey ?? playerVerseKey;
  // The word being recited, as a comparable id ('' when not listening).
  const recitedWord = useRecitationTrackingStore(s =>
    s.status === 'listening' && s.verseKey && s.wordIndex !== null
      ? `${s.verseKey}|${s.wordIndex}|${s.totalWords}`
      : '',
  );
  const lastNavigatedPage = useRef<number>(currentPage);

  // Reciting the last word on the page turns it at once, without waiting for
  // the next page's first ayah (paged mode only).
  useEffect(() => {
    if (!recitedWord || navigateToVerse) return;
    const [verseKey, wordIndex, totalWords] = recitedWord.split('|');
    const page = lastNavigatedPage.current;
    const last = lastWordOnPage(
      digitalKhattDataService.getPageLines(page),
      digitalKhattDataService,
    );
    if (!last || last.verseKey !== verseKey) return;
    const position = dkWordPosition(
      digitalKhattDataService.getVerseWords(verseKey),
      Number(wordIndex),
      Number(totalWords),
    );
    if (position === null || position < last.position) return;
    lastNavigatedPage.current = page + 1;
    navigateToPage(page + 1);
  }, [recitedWord, navigateToPage, navigateToVerse]);

  // Keep the ref in sync when the user manually scrolls
  useEffect(() => {
    lastNavigatedPage.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    if (!isFollowing || !currentVerseKey) return;

    // In verse-level navigation mode (vertical/list view), scroll to every ayah
    if (navigateToVerse) {
      navigateToVerse(currentVerseKey);
      // Still keep page ref in sync
      const targetPage =
        digitalKhattDataService.getPageForVerse(currentVerseKey);
      if (targetPage) lastNavigatedPage.current = targetPage;
      return;
    }

    // An ayah running over a page break is still on the page being recited.
    if (
      recitedVerseKey &&
      mushafVerseMapService
        .getOrderedVerseKeysForPage(lastNavigatedPage.current)
        .includes(recitedVerseKey)
    ) {
      return;
    }

    const targetPage = digitalKhattDataService.getPageForVerse(currentVerseKey);
    if (!targetPage) return;

    // Only navigate if the target page differs from the last navigated page
    if (targetPage !== lastNavigatedPage.current) {
      lastNavigatedPage.current = targetPage;
      navigateToPage(targetPage);
    }
  }, [
    isFollowing,
    currentVerseKey,
    recitedVerseKey,
    navigateToPage,
    navigateToVerse,
  ]);
}
