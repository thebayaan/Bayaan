// @ai-generated
/**
 * verseAnnotationsStore with rewayah verse units (decision 3), run against
 * the real annotations database (VerseAnnotationDatabaseService on the
 * expo-sqlite stand-in of test-utils, better-sqlite3) and real slots of the
 * Release 1 words DBs (fixture surahs). Every case checks the rows the
 * database holds afterwards, not the calls made:
 *  - rows keep the rewayah they were saved in; the Hafs-keyed sets and the
 *    optimistic mutations behave exactly as before;
 *  - marking a verse writes its Hafs anchor + rewayah, one row per verse:
 *    the parts of a split Hafs verse are two rows ("1:7:1", "1:7:5"); Hafs
 *    and identity verses write their Hafs keys, as before;
 *  - a row saved before verse units (Warsh "1:7") marks both parts;
 *  - un-marking deletes exactly the rows that mark the verse, each whole,
 *    and nothing else: every other row keeps its id and created_at;
 *  - one call is one transaction, and the store changes only once it has
 *    committed: a failure part-way leaves the database and the store as
 *    they were.
 */
import path from 'path';
import {
  openAdapterDatabase,
  type AdapterDatabase,
} from '@/test-utils/sqliteAdapter';
import {
  fixtureUnits,
  unitOf,
} from '@/services/verse-annotations/__fixtures__/verseUnitsTestData';
import type {RewayahVerseUnits} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {HighlightColor} from '@/types/verse-annotations';

jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);

type MockModule = typeof import('@/test-utils/mockExpoSqlite');
type StoreModule = typeof import('../verseAnnotationsStore');
type SettingsModule = typeof import('../mushafSettingsStore');
type DbModule =
  typeof import('@/services/database/VerseAnnotationDatabaseService');

const DB_FILE = 'verse-annotations.db';

interface Harness {
  store: StoreModule['useVerseAnnotationsStore'];
  selectUnitAnnotations: StoreModule['selectUnitAnnotations'];
  settings: SettingsModule['useMushafSettingsStore'];
  /** The connection the annotations service writes through. */
  db: AdapterDatabase;
  /** A second connection: it sees committed rows only. */
  reader: AdapterDatabase;
}

let h: Harness;

beforeEach(async () => {
  // Fresh modules per test: a new database file and an empty store.
  let loaded:
    | {
        mock: MockModule;
        store: StoreModule;
        settings: SettingsModule;
        dbModule: DbModule;
      }
    | undefined;
  jest.isolateModules(() => {
    loaded = {
      mock: require('@/test-utils/mockExpoSqlite'),
      store: require('../verseAnnotationsStore'),
      settings: require('../mushafSettingsStore'),
      dbModule: require('@/services/database/VerseAnnotationDatabaseService'),
    };
  });
  if (!loaded) throw new Error('modules not loaded');
  await loaded.dbModule.verseAnnotationDatabaseService.initialize();
  h = {
    store: loaded.store.useVerseAnnotationsStore,
    selectUnitAnnotations: loaded.store.selectUnitAnnotations,
    settings: loaded.settings.useMushafSettingsStore,
    db: await loaded.mock.openDatabaseAsync(DB_FILE),
    reader: openAdapterDatabase(path.join(loaded.mock.databaseDir(), DB_FILE)),
  };
  h.settings.setState({rewayah: 'hafs'});
});

afterEach(async () => {
  await h.reader.closeAsync();
  await h.db.closeAsync();
});

const state = () => h.store.getState();
const marksIn = (units: RewayahVerseUnits) =>
  h.selectUnitAnnotations(state(), units);
const warsh = () => fixtureUnits('warsh');

interface BookmarkDbRow {
  id: string;
  verse_key: string;
  surah_number: number;
  ayah_number: number;
  created_at: number;
  rewayah_id: string | null;
}

interface HighlightDbRow extends BookmarkDbRow {
  color: string;
}

interface NoteDbRow extends BookmarkDbRow {
  content: string;
  verse_keys: string | null;
}

/** Committed rows, by verse_key. */
const bookmarksInDb = () =>
  h.reader.getAllAsync<BookmarkDbRow>(
    'SELECT * FROM bookmarks ORDER BY verse_key',
  );
const highlightsInDb = () =>
  h.reader.getAllAsync<HighlightDbRow>(
    'SELECT * FROM highlights ORDER BY verse_key',
  );
const notesInDb = () =>
  h.reader.getAllAsync<NoteDbRow>('SELECT * FROM notes ORDER BY verse_key');

/** What identifies a row: [verse_key, rewayah_id] (and colour). */
const keysOf = (rows: BookmarkDbRow[]) =>
  rows.map(r => [r.verse_key, r.rewayah_id]);
const colouredKeysOf = (rows: HighlightDbRow[]) =>
  rows.map(r => [r.verse_key, r.rewayah_id, r.color]);

function hafsVerse(verseKey: string): [number, number] {
  const [surah, ayah] = verseKey.split(':').map(Number);
  return [surah, ayah];
}

async function seedBookmark(
  id: string,
  verseKey: string,
  rewayahId: RewayahId | null,
  createdAt: number,
): Promise<void> {
  await h.db.runAsync(
    `INSERT INTO bookmarks (id, verse_key, surah_number, ayah_number, created_at, rewayah_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, verseKey, ...hafsVerse(verseKey), createdAt, rewayahId],
  );
}

async function seedHighlight(
  id: string,
  verseKey: string,
  color: HighlightColor,
  rewayahId: RewayahId | null,
  createdAt: number,
): Promise<void> {
  await h.db.runAsync(
    `INSERT INTO highlights (id, verse_key, surah_number, ayah_number, color, created_at, rewayah_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, verseKey, ...hafsVerse(verseKey), color, createdAt, rewayahId],
  );
}

/** The store fields a write may change, as they are now (by reference). */
function storeFields() {
  const s = state();
  return {
    bookmarkedVerseKeys: s.bookmarkedVerseKeys,
    bookmarkRows: s.bookmarkRows,
    highlights: s.highlights,
    highlightRows: s.highlightRows,
    notedVerseKeys: s.notedVerseKeys,
    noteRows: s.noteRows,
  };
}

describe('rows keep their rewayah; the Hafs-keyed API is unchanged', () => {
  it('loads rows with their rewayah next to the Hafs-keyed sets', async () => {
    await seedBookmark('b1', '1:7:5', 'warsh', 1);
    await seedBookmark('b2', '1:2', 'hafs', 2);
    await h.db.runAsync(
      `INSERT INTO notes (id, verse_key, surah_number, ayah_number, content, verse_keys, created_at, updated_at, rewayah_id)
       VALUES ('n1', '1:7:1', 1, 7, 'note', '1:7:1,1:7:5', 3, 3, 'warsh')`,
    );
    await seedHighlight('h1', '1:5', 'green', null, 4);
    await state().loadAnnotationsForSurahs([1]);
    const s = state();
    // Exactly the base sets, keyed by the stored verse_key.
    expect([...s.bookmarkedVerseKeys].sort()).toEqual(['1:2', '1:7:5']);
    expect([...s.notedVerseKeys]).toEqual(['1:7:1']);
    expect(s.highlights).toEqual({'1:5': 'green'});
    expect(s.isBookmarked('1:7:5')).toBe(true);
    expect(s.getHighlightColor('1:5')).toBe('green');
    // And the rows behind them.
    expect(s.bookmarkRows).toEqual({
      '1:7:5': {verseKey: '1:7:5', rewayahId: 'warsh'},
      '1:2': {verseKey: '1:2', rewayahId: 'hafs'},
    });
    expect(s.noteRows).toEqual({
      'warsh|1:7:1': {verseKey: '1:7:1', rewayahId: 'warsh'},
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

    h.settings.setState({rewayah: 'warsh'});
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
    const first = marksIn(warsh());
    expect(marksIn(warsh())).toBe(first);
    state().addBookmark('1:7:1', 'warsh');
    const second = marksIn(warsh());
    expect(second).not.toBe(first);
    expect([...second.bookmarkedUnitKeys].sort()).toEqual(['1:6', '1:7']);
  });
});

describe('setUnitsBookmarked: the rows a call leaves', () => {
  it('stores each part of a split Hafs verse at its own anchor', async () => {
    const u = warsh();
    await state().setUnitsBookmarked(u, [unitOf(u, '1:6')], true);
    expect(await bookmarksInDb()).toMatchObject([
      {
        verse_key: '1:7:1',
        surah_number: 1,
        ayah_number: 7,
        rewayah_id: 'warsh',
      },
    ]);
    expect([...marksIn(u).bookmarkedUnitKeys]).toEqual(['1:6']);
    expect(state().loadedSurahs.has(1)).toBe(true);

    await state().setUnitsBookmarked(u, [unitOf(u, '1:7')], true);
    expect(keysOf(await bookmarksInDb())).toEqual([
      ['1:7:1', 'warsh'],
      ['1:7:5', 'warsh'],
    ]);
    expect([...marksIn(u).bookmarkedUnitKeys].sort()).toEqual(['1:6', '1:7']);

    // Un-bookmarking the later part leaves the first part bookmarked.
    await state().setUnitsBookmarked(u, [unitOf(u, '1:7')], false);
    expect(keysOf(await bookmarksInDb())).toEqual([['1:7:1', 'warsh']]);
    expect([...marksIn(u).bookmarkedUnitKeys]).toEqual(['1:6']);
    expect(state().bookmarkedVerseKeys).toEqual(new Set(['1:7:1']));
  });

  it('bookmarking both parts at once writes two rows, in one commit', async () => {
    const u = warsh();
    const seen: Promise<BookmarkDbRow[]>[] = [];
    await state().loadAnnotationsForSurahs([1]);
    const unsubscribe = h.store.subscribe(() => {
      // The reader runs the query at once: what was committed when the
      // store changed.
      seen.push(bookmarksInDb());
    });
    await state().setUnitsBookmarked(
      u,
      [unitOf(u, '1:7'), unitOf(u, '1:6')],
      true,
    );
    unsubscribe();
    expect(keysOf(await bookmarksInDb())).toEqual([
      ['1:7:1', 'warsh'],
      ['1:7:5', 'warsh'],
    ]);
    // One store change, after both rows were committed.
    expect(
      (await Promise.all(seen)).map(rows => rows.map(r => r.verse_key)),
    ).toEqual([['1:7:1', '1:7:5']]);
  });

  it('a row saved before verse units marks both parts and needs no new row', async () => {
    // develop: a Warsh reader bookmarked "1:7" (all of Hafs 1:7).
    await seedBookmark('legacy', '1:7', 'warsh', 5);
    await state().loadAnnotationsForSurahs([1]);
    const u = warsh();
    const marks = marksIn(u);
    expect([...marks.bookmarkedUnitKeys]).toEqual(['1:6', '1:7']);
    expect(marks.bookmarkRowKeys('1:6')).toEqual(['1:7']);
    const before = await bookmarksInDb();
    await state().setUnitsBookmarked(u, [unitOf(u, '1:6')], true);
    expect(await bookmarksInDb()).toEqual(before);
  });

  it('Hafs and identity verses write their Hafs keys, as before', async () => {
    const hafs = fixtureUnits('hafs');
    await state().setUnitsBookmarked(
      hafs,
      [unitOf(hafs, '1:6'), unitOf(hafs, '1:7')],
      true,
    );
    expect(keysOf(await bookmarksInDb())).toEqual([
      ['1:6', 'hafs'],
      ['1:7', 'hafs'],
    ]);
    expect([...state().bookmarkedVerseKeys]).toEqual(['1:6', '1:7']);
    await state().setUnitsBookmarked(hafs, [unitOf(hafs, '1:6')], false);
    expect(keysOf(await bookmarksInDb())).toEqual([['1:7', 'hafs']]);

    // Warsh: an identity verse, a renumbered whole verse, a merged verse.
    const u = warsh();
    await state().setUnitsBookmarked(
      u,
      [unitOf(u, '112:1'), unitOf(u, '1:1'), unitOf(u, '107:6')],
      true,
    );
    expect(keysOf(await bookmarksInDb())).toEqual([
      ['107:6', 'warsh'],
      ['112:1', 'warsh'],
      ['1:2', 'warsh'],
      ['1:7', 'hafs'],
    ]);
  });

  it('writes one row per verse of a range, in reading order, once', async () => {
    const u = warsh();
    await state().setUnitsBookmarked(
      u,
      [unitOf(u, '106:5'), unitOf(u, '106:4'), unitOf(u, '106:5')],
      true,
    );
    expect(keysOf(await bookmarksInDb())).toEqual([
      ['106:4:1', 'warsh'],
      ['106:4:5', 'warsh'],
    ]);
  });

  it('removing Warsh 1:7 under a Hafs 1:7 row deletes that row and nothing else', async () => {
    await seedBookmark('hafs-1-7', '1:7', 'hafs', 100);
    await seedBookmark('warsh-1-1', '1:2', 'warsh', 200);
    await seedBookmark('hafs-1-5', '1:5', 'hafs', 300);
    await seedBookmark('warsh-103-1', '103:1', 'warsh', 400);
    const before = await bookmarksInDb();
    await state().loadAnnotationsForSurahs([1, 103]);
    const u = warsh();
    expect([...marksIn(u).bookmarkedUnitKeys].sort()).toEqual([
      '103:1',
      '1:1',
      '1:4',
      '1:6',
      '1:7',
    ]);

    await state().setUnitsBookmarked(u, [unitOf(u, '1:7')], false);

    // The Hafs row goes whole; nothing is re-created, re-keyed or
    // restamped, and every other row keeps its id and created_at.
    expect(await bookmarksInDb()).toEqual(
      before.filter(r => r.id !== 'hafs-1-7'),
    );
    // Warsh 1:6 was marked by that row only, and Hafs 1:7 (shown in Hafs)
    // is no longer bookmarked either.
    expect([...marksIn(u).bookmarkedUnitKeys].sort()).toEqual([
      '103:1',
      '1:1',
      '1:4',
    ]);
    expect(state().isBookmarked('1:7')).toBe(false);
    expect(state().bookmarkRows['1:7']).toBeUndefined();
  });

  it('un-bookmarking deletes every row that marks the verse, legacy rows included', async () => {
    // A Hafs row and a legacy Warsh row, each marking Warsh 103:1; a legacy
    // Warsh "1:7" and a row written now, each marking Warsh 1:7.
    await seedBookmark('a', '103:2', 'hafs', 1);
    await seedBookmark('b', '103:1', 'warsh', 2);
    await seedBookmark('c', '1:7', 'warsh', 3);
    await seedBookmark('d', '1:7:5', 'warsh', 4);
    const u = warsh();
    await state().setUnitsBookmarked(
      u,
      [unitOf(u, '103:1'), unitOf(u, '1:7')],
      false,
    );
    expect(await bookmarksInDb()).toEqual([]);
    expect(marksIn(u).bookmarkedUnitKeys.size).toBe(0);
    expect(state().bookmarkedVerseKeys.size).toBe(0);
  });

  it('refuses verses of other data before writing anything', async () => {
    const u = warsh();
    const other = fixtureUnits('al-bazzi');
    await expect(
      state().setUnitsBookmarked(
        u,
        [unitOf(u, '1:6'), unitOf(other, '1:6')],
        true,
      ),
    ).rejects.toThrow();
    expect(await bookmarksInDb()).toEqual([]);
  });

  it('a failure part-way leaves the database and the store as they were', async () => {
    // Both rows mark Warsh 1:7; deleting whichever goes second fails.
    await seedBookmark('hafs-1-7', '1:7', 'hafs', 10);
    await seedBookmark('warsh-1-7', '1:7:5', 'warsh', 20);
    await h.db.execAsync(`
      CREATE TRIGGER fail_second_delete BEFORE DELETE ON bookmarks
      WHEN (SELECT COUNT(*) FROM bookmarks WHERE verse_key IN ('1:7', '1:7:5')) = 1
      BEGIN SELECT RAISE(ABORT, 'disk I/O error'); END;
    `);
    await state().loadAnnotationsForSurahs([1]);
    const before = await bookmarksInDb();
    const fields = storeFields();
    const u = warsh();

    await expect(
      state().setUnitsBookmarked(u, [unitOf(u, '1:7')], false),
    ).rejects.toThrow('disk I/O error');

    expect(await bookmarksInDb()).toEqual(before);
    expect(storeFields()).toEqual(fields);
    expect(state().bookmarkRows).toBe(fields.bookmarkRows);
    expect([...marksIn(u).bookmarkedUnitKeys]).toEqual(['1:6', '1:7']);

    // The same for adding: the first row of the call is not kept either.
    await h.db.execAsync(`
      CREATE TRIGGER fail_insert BEFORE INSERT ON bookmarks
      WHEN new.verse_key = '106:4:5'
      BEGIN SELECT RAISE(ABORT, 'disk I/O error'); END;
    `);
    await state().loadAnnotationsForSurahs([106]);
    const loaded = storeFields();
    await expect(
      state().setUnitsBookmarked(
        u,
        [unitOf(u, '106:4'), unitOf(u, '106:5')],
        true,
      ),
    ).rejects.toThrow('disk I/O error');
    expect(await bookmarksInDb()).toEqual(before);
    expect(state().bookmarkRows).toBe(loaded.bookmarkRows);
  });
});

describe('setUnitsHighlight: the rows a call leaves', () => {
  it('colours each verse at its own anchor', async () => {
    const u = warsh();
    await state().setUnitsHighlight(
      u,
      [unitOf(u, '106:4'), unitOf(u, '106:5')],
      'purple',
    );
    expect(colouredKeysOf(await highlightsInDb())).toEqual([
      ['106:4:1', 'warsh', 'purple'],
      ['106:4:5', 'warsh', 'purple'],
    ]);
    expect(marksIn(u).highlightColors).toEqual({
      '106:4': 'purple',
      '106:5': 'purple',
    });
  });

  it('recolouring one part of a split Hafs verse leaves the Hafs row as it was', async () => {
    await seedHighlight('hafs-1-7', '1:7', 'yellow', 'hafs', 10);
    const before = await highlightsInDb();
    const u = warsh();
    await state().setUnitsHighlight(u, [unitOf(u, '1:6')], 'green');
    const after = await highlightsInDb();
    expect(after[0]).toEqual(before[0]);
    expect(colouredKeysOf(after)).toEqual([
      ['1:7', 'hafs', 'yellow'],
      ['1:7:1', 'warsh', 'green'],
    ]);
    expect(marksIn(u).highlightColors).toEqual({
      '1:6': 'green',
      '1:7': 'yellow',
    });
  });

  it('removing a colour deletes exactly the rows that mark the verse, whole', async () => {
    await seedHighlight('hafs-106-4', '106:4', 'green', 'hafs', 1);
    await seedHighlight('warsh-106-5', '106:4:5', 'blue', 'warsh', 2);
    await seedHighlight('warsh-106-1', '106:1', 'yellow', 'warsh', 3);
    const before = await highlightsInDb();
    const u = warsh();
    await state().setUnitsHighlight(u, [unitOf(u, '106:5')], null);
    // The Hafs row also coloured Warsh 106:4: it goes whole, and no row is
    // written for Warsh 106:4.
    expect(await highlightsInDb()).toEqual(
      before.filter(r => r.id === 'warsh-106-1'),
    );
    expect(marksIn(u).highlightColors).toEqual({'106:1': 'yellow'});
    expect(state().highlights).toEqual({'106:1': 'yellow'});
  });

  it('removing one part of a split Hafs verse deletes the Hafs row only', async () => {
    await seedHighlight('hafs-1-7', '1:7', 'yellow', 'hafs', 1);
    const u = warsh();
    await state().setUnitsHighlight(u, [unitOf(u, '1:6')], null);
    expect(await highlightsInDb()).toEqual([]);
    expect(marksIn(u).highlightColors).toEqual({});
  });

  it('a row of another rewayah at the picked anchor is restamped; the verse it also coloured keeps its colour and created_at', async () => {
    // An al-Duri 1:6 row, not loaded as al-Duri units: in Warsh it colours
    // Hafs 1:7 from its anchored word on, Warsh 1:6 and 1:7.
    await seedHighlight('duri-1-6', '1:7:1', 'orange', 'al-duri-abi-amr', 50);
    const u = warsh();
    await state().loadAnnotationsForSurahs([1]);
    expect(marksIn(u).highlightColors).toEqual({
      '1:6': 'orange',
      '1:7': 'orange',
    });
    await state().setUnitsHighlight(u, [unitOf(u, '1:6')], 'green');
    const rows = await highlightsInDb();
    expect(colouredKeysOf(rows)).toEqual([
      ['1:7:1', 'warsh', 'green'],
      ['1:7:5', 'warsh', 'orange'],
    ]);
    // The upsert keeps the replaced row's id and created_at; the row that
    // keeps Warsh 1:7's colour was created when that row was.
    expect(rows[0]).toMatchObject({id: 'duri-1-6', created_at: 50});
    expect(rows[1].created_at).toBe(50);
    expect(rows[1].id).not.toBe('duri-1-6');
    expect(marksIn(u).highlightColors).toEqual({
      '1:6': 'green',
      '1:7': 'orange',
    });
  });

  it('a failure part-way leaves the database and the store as they were', async () => {
    await seedHighlight('duri-1-6', '1:7:1', 'orange', 'al-duri-abi-amr', 50);
    await h.db.execAsync(`
      CREATE TRIGGER fail_kept_row BEFORE INSERT ON highlights
      WHEN new.verse_key = '1:7:5'
      BEGIN SELECT RAISE(ABORT, 'disk I/O error'); END;
    `);
    await state().loadAnnotationsForSurahs([1]);
    const before = await highlightsInDb();
    const fields = storeFields();
    const u = warsh();
    await expect(
      state().setUnitsHighlight(u, [unitOf(u, '1:6')], 'green'),
    ).rejects.toThrow('disk I/O error');
    // The restamp that ran first is rolled back too.
    expect(await highlightsInDb()).toEqual(before);
    expect(storeFields()).toEqual(fields);
    expect(state().highlightRows).toBe(fields.highlightRows);
  });

  it('Hafs verses write exactly the rows of before', async () => {
    const hafs = fixtureUnits('hafs');
    await state().setUnitsHighlight(hafs, [unitOf(hafs, '103:2')], 'yellow');
    expect(colouredKeysOf(await highlightsInDb())).toEqual([
      ['103:2', 'hafs', 'yellow'],
    ]);
    expect(state().highlights).toEqual({'103:2': 'yellow'});
    await state().setUnitsHighlight(hafs, [unitOf(hafs, '103:2')], null);
    expect(await highlightsInDb()).toEqual([]);
    expect(state().highlights).toEqual({});
  });
});

describe('addUnitsNote', () => {
  it('anchors a note on several verses at each verse', async () => {
    const u = warsh();
    const saved = await state().addUnitsNote(
      u,
      [unitOf(u, '1:7'), unitOf(u, '1:6')],
      'text',
    );
    expect(await notesInDb()).toMatchObject([
      {
        verse_key: '1:7:1',
        surah_number: 1,
        ayah_number: 7,
        content: 'text',
        verse_keys: '1:7:1,1:7:5',
        rewayah_id: 'warsh',
      },
    ]);
    expect(saved.verseKeys).toEqual(['1:7:1', '1:7:5']);
    expect([...marksIn(u).notedUnitKeys].sort()).toEqual(['1:6', '1:7']);
  });

  it('a single verse stores no verse_keys (Hafs: the row of before)', async () => {
    const hafs = fixtureUnits('hafs');
    await state().addUnitsNote(hafs, [unitOf(hafs, '1:7')], 'text');
    expect(await notesInDb()).toMatchObject([
      {verse_key: '1:7', verse_keys: null, rewayah_id: 'hafs'},
    ]);
    expect([...state().notedVerseKeys]).toEqual(['1:7']);
  });

  it('needs a verse', async () => {
    await expect(state().addUnitsNote(warsh(), [], 'text')).rejects.toThrow();
    expect(await notesInDb()).toEqual([]);
  });
});
