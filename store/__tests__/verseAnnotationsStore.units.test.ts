// @ai-generated
/**
 * verseAnnotationsStore with rewayah verse units (decision 3), on real slots
 * of the Release 1 words DBs (fixture surahs):
 *  - rows keep the rewayah they were saved in; the Hafs-keyed sets and the
 *    optimistic mutations behave exactly as before;
 *  - marking a verse writes its Hafs anchor + rewayah (no schema change,
 *    no rewayah number), one row per verse, so the two parts of a split
 *    Hafs verse are two bookmarks / highlights;
 *  - un-marking a verse deletes every row that marks it, legacy rows too;
 *  - Hafs verses write exactly the rows the verse-actions sheet wrote.
 */
import {
  selectUnitAnnotations,
  useVerseAnnotationsStore,
} from '../verseAnnotationsStore';
import {useMushafSettingsStore} from '../mushafSettingsStore';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {
  fixtureUnits,
  unitOf,
} from '@/services/verse-annotations/__fixtures__/verseUnitsTestData';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {
  HighlightColor,
  VerseBookmark,
  VerseHighlight,
  VerseNote,
} from '@/types/verse-annotations';

jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {
    getAnnotationsForSurah: jest.fn(),
    addBookmark: jest.fn(),
    removeBookmark: jest.fn(),
    upsertHighlight: jest.fn(),
    removeHighlight: jest.fn(),
    addNote: jest.fn(),
  },
}));

const service = verseAnnotationService as unknown as Record<
  | 'getAnnotationsForSurah'
  | 'addBookmark'
  | 'removeBookmark'
  | 'upsertHighlight'
  | 'removeHighlight'
  | 'addNote',
  jest.Mock
>;

/** The rows the mocked database holds, per surah. */
let db: {
  bookmarks: VerseBookmark[];
  notes: VerseNote[];
  highlights: VerseHighlight[];
};

function bookmark(verseKey: string, rewayahId?: RewayahId): VerseBookmark {
  const [surah, ayah] = verseKey.split(':').map(Number);
  return {
    id: `bm-${verseKey}`,
    verseKey,
    surahNumber: surah,
    ayahNumber: ayah,
    createdAt: 0,
    rewayahId,
  };
}

function highlight(
  verseKey: string,
  color: HighlightColor,
  rewayahId?: RewayahId,
): VerseHighlight {
  const [surah, ayah] = verseKey.split(':').map(Number);
  return {
    id: `hl-${verseKey}`,
    verseKey,
    surahNumber: surah,
    ayahNumber: ayah,
    color,
    createdAt: 0,
    rewayahId,
  };
}

function note(
  verseKey: string,
  rewayahId?: RewayahId,
  verseKeys?: string[],
): VerseNote {
  const [surah, ayah] = verseKey.split(':').map(Number);
  return {
    id: `nt-${verseKey}`,
    verseKey,
    surahNumber: surah,
    ayahNumber: ayah,
    content: 'note',
    verseKeys,
    createdAt: 0,
    updatedAt: 0,
    rewayahId,
  };
}

function resetStore() {
  useVerseAnnotationsStore.setState({
    loadedSurahs: new Set<number>(),
    bookmarkedVerseKeys: new Set<string>(),
    notedVerseKeys: new Set<string>(),
    highlights: {},
    loading: false,
    bookmarkRows: {},
    noteRows: {},
    highlightRows: {},
  });
}

const state = () => useVerseAnnotationsStore.getState();
const marksIn = (rewayah: RewayahId) =>
  selectUnitAnnotations(state(), fixtureUnits(rewayah));

beforeEach(() => {
  resetStore();
  db = {bookmarks: [], notes: [], highlights: []};
  for (const mock of Object.values(service)) mock.mockReset();
  service.getAnnotationsForSurah.mockImplementation((surah: number) =>
    Promise.resolve({
      bookmarks: db.bookmarks.filter(b => b.surahNumber === surah),
      notes: db.notes.filter(n => n.surahNumber === surah),
      highlights: db.highlights.filter(h => h.surahNumber === surah),
    }),
  );
  service.addBookmark.mockResolvedValue(undefined);
  service.removeBookmark.mockResolvedValue(undefined);
  service.upsertHighlight.mockResolvedValue(undefined);
  service.removeHighlight.mockResolvedValue(undefined);
  service.addNote.mockImplementation(
    (
      verseKey: string,
      _s: number,
      _a: number,
      _c: string,
      verseKeys?: string[],
      rewayahId?: RewayahId,
    ) => Promise.resolve(note(verseKey, rewayahId, verseKeys)),
  );
  useMushafSettingsStore.setState({rewayah: 'hafs'});
});

describe('rows keep their rewayah; the Hafs-keyed API is unchanged', () => {
  it('loads rows with their rewayah next to the Hafs-keyed sets', async () => {
    db.bookmarks = [bookmark('1:7:5', 'warsh'), bookmark('1:2', 'hafs')];
    db.notes = [note('1:7', 'warsh', ['1:7', '1:7:5'])];
    db.highlights = [highlight('1:5', 'green')];
    await state().loadAnnotationsForSurahs([1]);
    const s = state();
    // Exactly the base sets, keyed by the stored verse_key.
    expect([...s.bookmarkedVerseKeys].sort()).toEqual(['1:2', '1:7:5']);
    expect([...s.notedVerseKeys]).toEqual(['1:7']);
    expect(s.highlights).toEqual({'1:5': 'green'});
    expect(s.isBookmarked('1:7:5')).toBe(true);
    expect(s.getHighlightColor('1:5')).toBe('green');
    // And the rows behind them.
    expect(s.bookmarkRows).toEqual({
      '1:7:5': {verseKey: '1:7:5', rewayahId: 'warsh'},
      '1:2': {verseKey: '1:2', rewayahId: 'hafs'},
    });
    expect(s.noteRows).toEqual({
      'warsh|1:7': {verseKey: '1:7', rewayahId: 'warsh'},
    });
    expect(s.highlightRows).toEqual({
      '1:5': {verseKey: '1:5', rewayahId: undefined, color: 'green'},
    });
  });

  it('optimistic mutations keep the sets of before and record the rewayah', () => {
    const s = state();
    s.addBookmark('2:255');
    expect(state().bookmarkedVerseKeys.has('2:255')).toBe(true);
    // Default: the mushaf's rewayah, as the database service stamps it.
    expect(state().bookmarkRows['2:255']).toEqual({
      verseKey: '2:255',
      rewayahId: 'hafs',
    });
    s.addBookmark('1:7:5', 'warsh');
    expect(state().bookmarkRows['1:7:5'].rewayahId).toBe('warsh');
    // INSERT OR IGNORE: a second add keeps the row (and its rewayah).
    state().addBookmark('1:7:5', 'qalun');
    expect(state().bookmarkRows['1:7:5'].rewayahId).toBe('warsh');
    state().removeBookmark('1:7:5');
    expect(state().bookmarkedVerseKeys.has('1:7:5')).toBe(false);
    expect(state().bookmarkRows['1:7:5']).toBeUndefined();

    // Upsert: a highlight recolours and restamps its row.
    state().setHighlight('1:7', 'green', 'hafs');
    state().setHighlight('1:7', 'blue', 'warsh');
    expect(state().highlights['1:7']).toBe('blue');
    expect(state().highlightRows['1:7']).toEqual({
      verseKey: '1:7',
      rewayahId: 'warsh',
      color: 'blue',
    });
    state().removeHighlight('1:7');
    expect(state().highlights['1:7']).toBeUndefined();
    expect(state().highlightRows['1:7']).toBeUndefined();

    useMushafSettingsStore.setState({rewayah: 'warsh'});
    state().addNote('1:7');
    state().addNote('1:7', 'hafs');
    expect(state().notedVerseKeys.has('1:7')).toBe(true);
    expect(Object.keys(state().noteRows).sort()).toEqual([
      'hafs|1:7',
      'warsh|1:7',
    ]);
    // Called once no note holds the key, in any rewayah.
    state().removeNote('1:7');
    expect(state().notedVerseKeys.has('1:7')).toBe(false);
    expect(state().noteRows).toEqual({});
  });

  it('selectUnitAnnotations is memoized per units and rows', () => {
    state().addBookmark('1:7:5', 'warsh');
    const first = marksIn('warsh');
    expect(marksIn('warsh')).toBe(first);
    state().addBookmark('1:7', 'warsh');
    const second = marksIn('warsh');
    expect(second).not.toBe(first);
    expect([...second.bookmarkedUnitKeys]).toEqual(['1:7', '1:6']);
  });
});

describe('setUnitsBookmarked', () => {
  it('bookmarks each part of a split Hafs verse as its own row', async () => {
    const u = fixtureUnits('warsh');
    await state().setUnitsBookmarked(u, [unitOf(u, '1:7')], true);
    expect(service.addBookmark).toHaveBeenCalledTimes(1);
    expect(service.addBookmark).toHaveBeenLastCalledWith(
      '1:7:5',
      1,
      7,
      'warsh',
    );
    expect([...marksIn('warsh').bookmarkedUnitKeys]).toEqual(['1:7']);
    expect(state().loadedSurahs.has(1)).toBe(true);

    await state().setUnitsBookmarked(u, [unitOf(u, '1:6')], true);
    expect(service.addBookmark).toHaveBeenLastCalledWith('1:7', 1, 7, 'warsh');
    expect([...marksIn('warsh').bookmarkedUnitKeys].sort()).toEqual([
      '1:6',
      '1:7',
    ]);

    // Un-bookmarking the later part leaves the first part bookmarked.
    await state().setUnitsBookmarked(u, [unitOf(u, '1:7')], false);
    expect(service.removeBookmark).toHaveBeenCalledTimes(1);
    expect(service.removeBookmark).toHaveBeenLastCalledWith('1:7:5');
    expect([...marksIn('warsh').bookmarkedUnitKeys]).toEqual(['1:6']);
    expect(state().bookmarkedVerseKeys.has('1:7')).toBe(true);
  });

  it('writes one row per verse of a range, in reading order, once', async () => {
    const u = fixtureUnits('warsh');
    await state().setUnitsBookmarked(
      u,
      [unitOf(u, '106:5'), unitOf(u, '106:4'), unitOf(u, '106:5')],
      true,
    );
    expect(service.addBookmark.mock.calls).toEqual([
      ['106:4', 106, 4, 'warsh'],
      ['106:4:5', 106, 4, 'warsh'],
    ]);
  });

  it('a verse already marked by a Hafs or legacy row gets no second row', async () => {
    db.bookmarks = [bookmark('1:7', 'hafs')];
    const u = fixtureUnits('warsh');
    await state().setUnitsBookmarked(u, [unitOf(u, '1:7')], true);
    expect(service.addBookmark).not.toHaveBeenCalled();
    expect([...marksIn('warsh').bookmarkedUnitKeys]).toEqual(['1:6', '1:7']);
  });

  it('un-bookmarking deletes every row that marks the verse', async () => {
    // A Hafs row (both parts) and a legacy Warsh row on the Hafs key.
    db.bookmarks = [bookmark('103:2', 'hafs'), bookmark('103:1', 'warsh')];
    const u = fixtureUnits('warsh');
    await state().setUnitsBookmarked(u, [unitOf(u, '103:1')], false);
    expect(service.removeBookmark.mock.calls.flat().sort()).toEqual([
      '103:1',
      '103:2',
    ]);
    expect(marksIn('warsh').bookmarkedUnitKeys.size).toBe(0);
    expect(state().bookmarkedVerseKeys.size).toBe(0);
  });

  it('un-bookmarking one part of a split Hafs verse keeps the other part', async () => {
    db.bookmarks = [bookmark('1:7', 'hafs')];
    const u = fixtureUnits('warsh');
    await state().setUnitsBookmarked(u, [unitOf(u, '1:7')], false);
    // The Hafs row marked both parts: it goes, and Warsh 1:6 gets its own.
    expect(service.removeBookmark.mock.calls).toEqual([['1:7']]);
    expect(service.addBookmark.mock.calls).toEqual([['1:7', 1, 7, 'warsh']]);
    expect([...marksIn('warsh').bookmarkedUnitKeys]).toEqual(['1:6']);
    expect(state().bookmarkRows['1:7']).toEqual({
      verseKey: '1:7',
      rewayahId: 'warsh',
    });
  });

  it('un-bookmarking every part keeps nothing', async () => {
    db.bookmarks = [bookmark('1:7', 'hafs')];
    const u = fixtureUnits('warsh');
    await state().setUnitsBookmarked(
      u,
      [unitOf(u, '1:6'), unitOf(u, '1:7')],
      false,
    );
    expect(service.removeBookmark.mock.calls).toEqual([['1:7']]);
    expect(service.addBookmark).not.toHaveBeenCalled();
    expect(marksIn('warsh').bookmarkedUnitKeys.size).toBe(0);
  });

  it('Hafs verses write exactly the rows of before', async () => {
    const u = fixtureUnits('hafs');
    await state().setUnitsBookmarked(
      u,
      [unitOf(u, '1:6'), unitOf(u, '1:7')],
      true,
    );
    expect(service.addBookmark.mock.calls).toEqual([
      ['1:6', 1, 6, 'hafs'],
      ['1:7', 1, 7, 'hafs'],
    ]);
    expect([...state().bookmarkedVerseKeys]).toEqual(['1:6', '1:7']);
    await state().setUnitsBookmarked(u, [unitOf(u, '1:6')], false);
    expect(service.removeBookmark.mock.calls).toEqual([['1:6']]);
    expect([...state().bookmarkedVerseKeys]).toEqual(['1:7']);
  });

  it('refuses verses of other data before writing anything', async () => {
    const u = fixtureUnits('warsh');
    const other = fixtureUnits('al-bazzi');
    await expect(
      state().setUnitsBookmarked(
        u,
        [unitOf(u, '1:6'), unitOf(other, '1:6')],
        true,
      ),
    ).rejects.toThrow();
    expect(service.addBookmark).not.toHaveBeenCalled();
  });
});

describe('setUnitsHighlight', () => {
  it('colours each verse at its own anchor', async () => {
    const u = fixtureUnits('warsh');
    await state().setUnitsHighlight(
      u,
      [unitOf(u, '106:4'), unitOf(u, '106:5')],
      'purple',
    );
    expect(service.upsertHighlight.mock.calls).toEqual([
      ['106:4', 106, 4, 'purple', 'warsh'],
      ['106:4:5', 106, 4, 'purple', 'warsh'],
    ]);
    expect(marksIn('warsh').highlightColors).toEqual({
      '106:4': 'purple',
      '106:5': 'purple',
    });
  });

  it('removing a colour deletes every row that marks the verse', async () => {
    db.highlights = [
      highlight('106:4', 'green', 'hafs'),
      highlight('106:4:5', 'blue', 'warsh'),
    ];
    const u = fixtureUnits('warsh');
    await state().setUnitsHighlight(u, [unitOf(u, '106:5')], null);
    expect(service.removeHighlight.mock.calls.flat().sort()).toEqual([
      '106:4',
      '106:4:5',
    ]);
    // The Hafs row also coloured Warsh 106:4, which keeps its colour.
    expect(service.upsertHighlight.mock.calls).toEqual([
      ['106:4', 106, 4, 'green', 'warsh'],
    ]);
    expect(marksIn('warsh').highlightColors).toEqual({'106:4': 'green'});
  });

  it('recolouring one part of a split Hafs verse keeps the other part', async () => {
    db.highlights = [highlight('1:7', 'yellow', 'hafs')];
    const u = fixtureUnits('warsh');
    expect(marksIn('warsh').highlightColors).toEqual({});
    await state().setUnitsHighlight(u, [unitOf(u, '1:6')], 'green');
    // Warsh 1:6's anchor is the Hafs row's key: the upsert restamps it, and
    // Warsh 1:7 gets a row of its own with the colour it showed.
    expect(service.upsertHighlight.mock.calls).toEqual([
      ['1:7', 1, 7, 'green', 'warsh'],
      ['1:7:5', 1, 7, 'yellow', 'warsh'],
    ]);
    expect(marksIn('warsh').highlightColors).toEqual({
      '1:6': 'green',
      '1:7': 'yellow',
    });
  });

  it('removing one part of a split Hafs verse keeps the other part', async () => {
    db.highlights = [highlight('1:7', 'yellow', 'hafs')];
    const u = fixtureUnits('warsh');
    await state().setUnitsHighlight(u, [unitOf(u, '1:6')], null);
    expect(service.removeHighlight.mock.calls).toEqual([['1:7']]);
    expect(service.upsertHighlight.mock.calls).toEqual([
      ['1:7:5', 1, 7, 'yellow', 'warsh'],
    ]);
    expect(marksIn('warsh').highlightColors).toEqual({'1:7': 'yellow'});
    // Both parts: nothing is kept.
    resetStore();
    service.removeHighlight.mockClear();
    service.upsertHighlight.mockClear();
    await state().setUnitsHighlight(
      u,
      [unitOf(u, '1:6'), unitOf(u, '1:7')],
      null,
    );
    expect(service.removeHighlight.mock.calls).toEqual([['1:7']]);
    expect(service.upsertHighlight).not.toHaveBeenCalled();
  });

  it('Hafs verses write exactly the rows of before', async () => {
    const u = fixtureUnits('hafs');
    await state().setUnitsHighlight(u, [unitOf(u, '103:2')], 'yellow');
    expect(service.upsertHighlight.mock.calls).toEqual([
      ['103:2', 103, 2, 'yellow', 'hafs'],
    ]);
    expect(state().highlights).toEqual({'103:2': 'yellow'});
  });
});

describe('addUnitsNote', () => {
  it('anchors a note on several verses at each verse', async () => {
    const u = fixtureUnits('warsh');
    const saved = await state().addUnitsNote(
      u,
      [unitOf(u, '1:7'), unitOf(u, '1:6')],
      'text',
    );
    expect(service.addNote.mock.calls).toEqual([
      ['1:7', 1, 7, 'text', ['1:7', '1:7:5'], 'warsh'],
    ]);
    expect(saved.verseKeys).toEqual(['1:7', '1:7:5']);
    expect([...marksIn('warsh').notedUnitKeys].sort()).toEqual(['1:6', '1:7']);
  });

  it('a single verse stores no verse_keys (Hafs: the row of before)', async () => {
    const u = fixtureUnits('hafs');
    await state().addUnitsNote(u, [unitOf(u, '1:7')], 'text');
    expect(service.addNote.mock.calls).toEqual([
      ['1:7', 1, 7, 'text', undefined, 'hafs'],
    ]);
    expect([...state().notedVerseKeys]).toEqual(['1:7']);
  });

  it('needs a verse', async () => {
    await expect(
      state().addUnitsNote(fixtureUnits('warsh'), [], 'text'),
    ).rejects.toThrow();
    expect(service.addNote).not.toHaveBeenCalled();
  });
});
