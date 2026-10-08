// @ai-generated
/**
 * The player verse selection records the numbering of its key (decision 3):
 * a verse row of a rewayah selects its own verse ('1:6' of Warsh), a Hafs
 * verse row selects in Hafs (the default, so existing callers keep their
 * meaning), and clearing drops both.
 */
import {useVerseSelectionStore} from '../verseSelectionStore';

const state = () => {
  const s = useVerseSelectionStore.getState();
  return [
    s.selectedVerseKey,
    s.selectedSurahNumber,
    s.selectedAyahNumber,
    s.selectedRewayah,
  ];
};

describe('verseSelectionStore', () => {
  beforeEach(() => useVerseSelectionStore.getState().clearSelection());

  it('starts empty', () => {
    expect(state()).toEqual([null, null, null, null]);
  });

  it('a key without a numbering is a Hafs key', () => {
    useVerseSelectionStore.getState().selectVerse('2:255', 2, 255);
    expect(state()).toEqual(['2:255', 2, 255, 'hafs']);
  });

  it('a rewayah verse keeps its rewayah', () => {
    useVerseSelectionStore.getState().selectVerse('1:6', 1, 6, 'warsh');
    expect(state()).toEqual(['1:6', 1, 6, 'warsh']);
  });

  it('clearing drops the key and its numbering', () => {
    useVerseSelectionStore.getState().selectVerse('1:6', 1, 6, 'warsh');
    useVerseSelectionStore.getState().clearSelection();
    expect(state()).toEqual([null, null, null, null]);
  });
});
