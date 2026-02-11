import {useCallback, useEffect} from 'react';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import type {HighlightColor} from '@/types/verse-annotations';

export function useVerseAnnotations(surahNumber: number) {
  const loadAnnotationsForSurah = useVerseAnnotationsStore(
    s => s.loadAnnotationsForSurah,
  );
  const bookmarkedVerseKeys = useVerseAnnotationsStore(
    s => s.bookmarkedVerseKeys,
  );
  const notedVerseKeys = useVerseAnnotationsStore(s => s.notedVerseKeys);
  const highlights = useVerseAnnotationsStore(s => s.highlights);
  const loading = useVerseAnnotationsStore(s => s.loading);

  useEffect(() => {
    loadAnnotationsForSurah(surahNumber);
  }, [surahNumber, loadAnnotationsForSurah]);

  const isBookmarked = useCallback(
    (verseKey: string) => bookmarkedVerseKeys.has(verseKey),
    [bookmarkedVerseKeys],
  );

  const hasNote = useCallback(
    (verseKey: string) => notedVerseKeys.has(verseKey),
    [notedVerseKeys],
  );

  const getHighlightColor = useCallback(
    (verseKey: string): HighlightColor | null => highlights[verseKey] ?? null,
    [highlights],
  );

  return {isBookmarked, hasNote, getHighlightColor, loading};
}
