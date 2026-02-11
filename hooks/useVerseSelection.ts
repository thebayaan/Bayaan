import {useCallback} from 'react';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';

export function useVerseSelection() {
  const selectedVerseKey = useVerseSelectionStore(s => s.selectedVerseKey);
  const selectVerse = useVerseSelectionStore(s => s.selectVerse);
  const clearSelection = useVerseSelectionStore(s => s.clearSelection);

  const isSelected = useCallback(
    (verseKey: string) => selectedVerseKey === verseKey,
    [selectedVerseKey],
  );

  return {selectedVerseKey, selectVerse, clearSelection, isSelected};
}
