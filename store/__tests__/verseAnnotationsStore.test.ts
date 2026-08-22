// @ai — regression tests for the multi-surah annotation load that backs
// the mushaf bookmark-highlight fix: merge across surahs, already-loaded
// no-ops, and serialization of concurrent loads (the old `loading` guard
// dropped them).
//
// The cache accumulates ("which surahs are in the store") and is subset-aware,
// rather than keying the store on the last loaded set and replacing it. That
// is what keeps a narrow per-surah load from wiping a wider page-level one and
// keeps still-mounted neighbour pages tinted. The concurrency test below holds
// the page-level load open with a `deferred()` gate so it actually exercises
// the race — awaiting the superset first can never reproduce it.
import {useVerseAnnotationsStore} from '../verseAnnotationsStore';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import type {
  VerseBookmark,
  VerseHighlight,
  VerseNote,
} from '@/types/verse-annotations';

jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {
    getAnnotationsForSurah: jest.fn(),
  },
}));

const mockGetAnnotations =
  verseAnnotationService.getAnnotationsForSurah as jest.Mock;

interface SurahAnnotations {
  bookmarks: VerseBookmark[];
  notes: VerseNote[];
  highlights: VerseHighlight[];
}

function bookmark(verseKey: string): VerseBookmark {
  const [surah, ayah] = verseKey.split(':').map(Number);
  return {
    id: `bm-${verseKey}`,
    verseKey,
    surahNumber: surah,
    ayahNumber: ayah,
    createdAt: 0,
  };
}

function annotations(
  partial: Partial<SurahAnnotations> = {},
): SurahAnnotations {
  return {bookmarks: [], notes: [], highlights: [], ...partial};
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return {promise, resolve};
}

function loadedList() {
  return [...useVerseAnnotationsStore.getState().loadedSurahs].sort(
    (a, b) => a - b,
  );
}

function resetStore() {
  useVerseAnnotationsStore.setState({
    loadedSurahs: new Set<number>(),
    bookmarkedVerseKeys: new Set<string>(),
    notedVerseKeys: new Set<string>(),
    highlights: {},
    loading: false,
  });
}

describe('verseAnnotationsStore multi-surah loading', () => {
  beforeEach(() => {
    resetStore();
    mockGetAnnotations.mockReset();
    mockGetAnnotations.mockResolvedValue(annotations());
  });

  it('merges annotations across every surah on a multi-surah page', async () => {
    mockGetAnnotations.mockImplementation((surah: number) => {
      if (surah === 112)
        return Promise.resolve(annotations({bookmarks: [bookmark('112:1')]}));
      if (surah === 114)
        return Promise.resolve(
          annotations({
            bookmarks: [bookmark('114:3')],
            highlights: [
              {
                id: 'hl-114:2',
                verseKey: '114:2',
                surahNumber: 114,
                ayahNumber: 2,
                color: 'green',
                createdAt: 0,
              },
            ],
          }),
        );
      return Promise.resolve(annotations());
    });

    await useVerseAnnotationsStore
      .getState()
      .loadAnnotationsForSurahs([112, 113, 114]);

    const state = useVerseAnnotationsStore.getState();
    expect(loadedList()).toEqual([112, 113, 114]);
    expect(state.bookmarkedVerseKeys.has('112:1')).toBe(true);
    expect(state.bookmarkedVerseKeys.has('114:3')).toBe(true);
    expect(state.highlights['114:2']).toBe('green');
    expect(state.loading).toBe(false);
  });

  it('no-ops when every requested surah is already loaded', async () => {
    const store = useVerseAnnotationsStore.getState();
    await store.loadAnnotationsForSurahs([1, 2]);
    expect(mockGetAnnotations).toHaveBeenCalledTimes(2);

    await store.loadAnnotationsForSurahs([2, 1, 2]);
    expect(mockGetAnnotations).toHaveBeenCalledTimes(2);
  });

  it('fetches only the surahs still missing (subset-aware)', async () => {
    const store = useVerseAnnotationsStore.getState();
    await store.loadAnnotationsForSurahs([1, 2]);
    expect(mockGetAnnotations).toHaveBeenCalledTimes(2);

    // 2 is already loaded → only 3 is fetched, and 1/2 stay loaded.
    await store.loadAnnotationsForSurahs([2, 3]);
    expect(mockGetAnnotations).toHaveBeenCalledTimes(3);
    expect(mockGetAnnotations).toHaveBeenLastCalledWith(3);
    expect(loadedList()).toEqual([1, 2, 3]);
  });

  it('per-surah load is a no-op against an already-loaded page set', async () => {
    mockGetAnnotations.mockImplementation((surah: number) =>
      Promise.resolve(
        surah === 114
          ? annotations({bookmarks: [bookmark('114:3')]})
          : annotations(),
      ),
    );
    const store = useVerseAnnotationsStore.getState();
    await store.loadAnnotationsForSurahs([112, 113, 114]);

    // ContinuousMushafView-style per-surah call must NOT narrow the store
    // back to one surah — that would unpaint sibling-surah bookmarks.
    await store.loadAnnotationsForSurah(113);
    expect(loadedList()).toEqual([112, 113, 114]);
    expect(
      useVerseAnnotationsStore.getState().bookmarkedVerseKeys.has('114:3'),
    ).toBe(true);

    // A surah outside the loaded set still loads — and ACCUMULATES rather
    // than narrowing, so a neighbour page keeps its tint.
    await store.loadAnnotationsForSurah(50);
    expect(loadedList()).toEqual([50, 112, 113, 114]);
    expect(
      useVerseAnnotationsStore.getState().bookmarkedVerseKeys.has('114:3'),
    ).toBe(true);
  });

  it('a per-surah load racing an in-flight page load keeps sibling bookmarks', async () => {
    const gate = deferred<SurahAnnotations>();
    mockGetAnnotations.mockImplementation((surah: number) => {
      // Hold the page-level load open so the per-surah call is issued while
      // it is genuinely still in flight.
      if (surah === 112) return gate.promise;
      if (surah === 114)
        return Promise.resolve(annotations({bookmarks: [bookmark('114:3')]}));
      return Promise.resolve(annotations());
    });

    const store = useVerseAnnotationsStore.getState();
    const pageLoad = store.loadAnnotationsForSurahs([112, 113, 114]);
    // The player's per-surah load for a surah INSIDE the in-flight set. An
    // exact-key cache couldn't see 113 as covered (the key wasn't set yet),
    // then its recheck compared '112,113,114' === '113', re-fetched 113 alone
    // and REPLACED the store — dropping 112 and 114.
    const perSurah = store.loadAnnotationsForSurah(113);

    gate.resolve(annotations({bookmarks: [bookmark('112:1')]}));
    await Promise.all([pageLoad, perSurah]);

    const state = useVerseAnnotationsStore.getState();
    expect(state.bookmarkedVerseKeys.has('112:1')).toBe(true);
    expect(state.bookmarkedVerseKeys.has('114:3')).toBe(true);
    expect(loadedList()).toEqual([112, 113, 114]);
  });

  it('serializes a load requested while another is in flight (no drop)', async () => {
    const gate = deferred<SurahAnnotations>();
    let firstCall = true;
    mockGetAnnotations.mockImplementation((surah: number) => {
      if (firstCall) {
        firstCall = false;
        return gate.promise;
      }
      return Promise.resolve(
        surah === 2
          ? annotations({bookmarks: [bookmark('2:255')]})
          : annotations(),
      );
    });

    const store = useVerseAnnotationsStore.getState();
    const first = store.loadAnnotationsForSurahs([1]);
    const second = store.loadAnnotationsForSurahs([1, 2]);

    gate.resolve(annotations({bookmarks: [bookmark('1:5')]}));
    await Promise.all([first, second]);

    // The old `if (loading) return` guard dropped the second call outright; it
    // must run after the first, and both surahs end up loaded + merged.
    const state = useVerseAnnotationsStore.getState();
    expect(loadedList()).toEqual([1, 2]);
    expect(state.bookmarkedVerseKeys.has('1:5')).toBe(true);
    expect(state.bookmarkedVerseKeys.has('2:255')).toBe(true);
  });

  it('leaves already-loaded surahs intact when a load fails', async () => {
    const store = useVerseAnnotationsStore.getState();
    await store.loadAnnotationsForSurahs([1]);
    expect(loadedList()).toEqual([1]);

    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockGetAnnotations.mockRejectedValueOnce(new Error('db closed'));
    await store.loadAnnotationsForSurahs([2]);
    consoleError.mockRestore();

    expect(loadedList()).toEqual([1]);
    expect(useVerseAnnotationsStore.getState().loading).toBe(false);

    // And the next load still works (in-flight slot was released).
    await store.loadAnnotationsForSurahs([2]);
    expect(loadedList()).toEqual([1, 2]);
  });

  it('optimistic bookmark mutations update the set immediately', () => {
    const store = useVerseAnnotationsStore.getState();
    store.addBookmark('1:5');
    expect(useVerseAnnotationsStore.getState().isBookmarked('1:5')).toBe(true);
    store.removeBookmark('1:5');
    expect(useVerseAnnotationsStore.getState().isBookmarked('1:5')).toBe(false);
  });
});
