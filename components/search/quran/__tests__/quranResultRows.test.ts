// @ai-generated
import {
  isRootOutcome,
  QURAN_PAGE_SIZE,
  quranAyahCount,
  quranResultRows,
  type QuranResultView,
} from '../quranResultRows';
import type {QuranSearchState} from '@/hooks/useQuranSearch';
import type {
  QuranSearchOutcome,
  RootSearchResult,
} from '@/services/search/QuranSearchDataService';
import type {QuranVerseHit} from '@/utils/search/quranSearch';
import {verseKeyAt} from '@/utils/search/quranIndexFormat';

const hit = (verseIndex: number): QuranVerseHit => ({
  verseIndex,
  verseKey: verseKeyAt(verseIndex),
  matches: [{position: 1, length: 1}],
  score: 130,
});

const view = (patch: Partial<QuranResultView> = {}): QuranResultView => ({
  shown: QURAN_PAGE_SIZE,
  selectedLemma: null,
  hafsNote: false,
  query: 'الرحمن',
  includeEmpty: false,
  ...patch,
});

const done = (outcome: QuranSearchOutcome): QuranSearchState => ({
  status: 'done',
  outcome,
});

const root = {id: 7, root: 'ر ح م', words: 339, ayahs: 313};

function text(
  hits: QuranVerseHit[],
  kind: 'phrase' | 'allWords' = 'phrase',
): QuranSearchOutcome {
  return {
    kind: 'text',
    result: {
      kind,
      hits,
      ayahCount: hits.length,
      occurrenceCount: hits.length + 1,
    },
    rootSuggestions: [],
  };
}

const types = (state: QuranSearchState, v = view()) =>
  quranResultRows(state, v).map(row => row.type);

describe('quranResultRows', () => {
  it('is empty while idle, a row while loading or failed', () => {
    expect(quranResultRows({status: 'idle'}, view())).toEqual([]);
    expect(types({status: 'searching', previous: null})).toEqual([
      'quran-loading',
    ]);
    expect(types({status: 'error'})).toEqual(['quran-error']);
  });

  it('heads the verses with their counts', () => {
    const rows = quranResultRows(done(text([hit(0), hit(5)])), view());
    expect(rows[0]).toEqual({
      type: 'quran-header',
      key: 'quran-header',
      ayahCount: 2,
      matchCount: 3,
      note: 'none',
    });
    expect(rows.slice(1).map(row => row.key)).toEqual([
      'quran-verse-1:1',
      'quran-verse-1:6',
    ]);
  });

  it('adds the Hafs note only when asked, and the all-words note first', () => {
    const header = (state: QuranSearchState, v: QuranResultView) =>
      quranResultRows(state, v)[0];
    expect(header(done(text([hit(0)])), view({hafsNote: true}))).toMatchObject({
      note: 'hafs',
    });
    expect(
      header(done(text([hit(0)], 'allWords')), view({hafsNote: true})),
    ).toMatchObject({note: 'allWords'});
  });

  it('shows 30 ayahs at a time, then how many more', () => {
    const hits = Array.from({length: 75}, (_, i) => hit(i));
    const first = quranResultRows(done(text(hits)), view());
    expect(first.filter(row => row.type === 'quran-verse')).toHaveLength(30);
    expect(first[first.length - 1]).toEqual({
      type: 'quran-more',
      key: 'quran-more',
      remaining: 45,
    });
    const all = quranResultRows(done(text(hits)), view({shown: 90}));
    expect(all.filter(row => row.type === 'quran-verse')).toHaveLength(75);
    expect(all.some(row => row.type === 'quran-more')).toBe(false);
  });

  it('lists root suggestions before the verses', () => {
    const outcome: QuranSearchOutcome = {
      ...text([hit(0)]),
      rootSuggestions: [root],
    } as QuranSearchOutcome;
    expect(types(done(outcome))).toEqual([
      'quran-header',
      'quran-root-suggestion',
      'quran-verse',
    ]);
  });

  it('orders a root search as header, lemma chips, then verses', () => {
    const lemmas = [
      {id: 1, rootId: 7, lemma: 'رَّحِيم', words: 116, ayahs: 95},
      {id: 2, rootId: 7, lemma: 'رَحْمَة', words: 114, ayahs: 110},
    ];
    const result: RootSearchResult = {
      root,
      lemmas,
      hits: lemmaId => (lemmaId === 2 ? [hit(3)] : [hit(0), hit(3), hit(9)]),
    };
    const outcome: QuranSearchOutcome = {
      kind: 'root',
      letters: 'رحم',
      candidates: [root],
      result,
    };
    expect(types(done(outcome))).toEqual([
      'quran-root-header',
      'quran-lemmas',
      'quran-verse',
      'quran-verse',
      'quran-verse',
    ]);
    // A selected lemma filters the verses and marks its chip.
    const filtered = quranResultRows(done(outcome), view({selectedLemma: 2}));
    expect(filtered[1]).toMatchObject({type: 'quran-lemmas', selected: 2});
    expect(
      filtered.filter(row => row.type === 'quran-verse').map(row => row.key),
    ).toEqual(['quran-verse-1:4']);
    expect(quranAyahCount(done(outcome), 2)).toBe(1);
    expect(isRootOutcome(done(outcome))).toBe(true);
  });

  it('adds an empty row only when asked', () => {
    expect(quranResultRows(done(text([])), view())).toEqual([]);
    expect(quranResultRows(done(text([])), view({includeEmpty: true}))).toEqual(
      [{type: 'quran-empty', key: 'quran-empty', query: 'الرحمن', root: false}],
    );
    const unknownRoot: QuranSearchOutcome = {
      kind: 'root',
      letters: 'ظظظ',
      candidates: [],
      result: null,
    };
    expect(quranResultRows(done(unknownRoot), view())).toEqual([]);
    expect(
      quranResultRows(done(unknownRoot), view({includeEmpty: true}))[0],
    ).toMatchObject({type: 'quran-empty', root: true});
  });

  it('keeps the last results while the next search runs', () => {
    const previous = text([hit(0)]);
    expect(types({status: 'searching', previous})).toEqual([
      'quran-header',
      'quran-verse',
    ]);
    expect(quranAyahCount({status: 'searching', previous})).toBe(1);
    expect(quranAyahCount({status: 'idle'})).toBe(0);
  });
});
