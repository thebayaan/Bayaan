jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import path from 'path';
import {
  DIGEST_TABLES,
  copyGoldenInto,
  goldenDbFiles,
  goldenManifest,
  listTables,
  primaryKey,
  readTable,
  rowsDigest,
  type Row,
} from '@/test-utils/goldenDb';
import {openAdapterDatabase} from '@/test-utils/sqliteAdapter';
import {
  PERSISTED_ID_MIGRATIONS,
  isRewayahId,
} from '@/services/rewayah/RewayahIdentity';

type MockModule = typeof import('@/test-utils/mockExpoSqlite');
type Annotations =
  typeof import('../VerseAnnotationDatabaseService').verseAnnotationDatabaseService;
type Playlists = typeof import('../DatabaseService').databaseService;
type Tafseer =
  typeof import('@/services/tafseer/TafseerDbService').tafseerDbService;
type Translations =
  typeof import('@/services/translation/TranslationDbService').translationDbService;
type Adhkar = typeof import('@/services/adhkar/AdhkarService').adhkarService;
type AdhkarDb = typeof import('../AdhkarDatabaseService').adhkarDatabaseService;
type Uploads =
  typeof import('@/services/uploads/UploadsDatabaseService').uploadsDatabaseService;

interface Services {
  mock: MockModule;
  annotations: Annotations;
  playlists: Playlists;
  tafseer: Tafseer;
  translations: Translations;
  adhkar: Adhkar;
  adhkarDb: AdhkarDb;
  uploads: Uploads;
}

interface TableDump {
  pk: string[];
  rows: Row[];
}
type Dump = Record<string, TableDump>;

// v2.2.1-first-launch keeps the rewayah ids exactly as v2.2.1 wrote them on
// its first launch (legacy slugs and NULL). The other sets model the state
// after a second launch of the release (see scripts/golden-dbs).
const FIRST_LAUNCH_TAG = 'v2.2.1-first-launch';
const TAGS = ['v2.3.0', 'v2.2.1', FIRST_LAUNCH_TAG, 'v2.1.2'];
// v2.1.2 predates rewayah_id: develop adds the column and backfills 'hafs'.
const PRE_REWAYAH_TAG = 'v2.1.2';
const SURAHS = [1, 2, 18, 114];
const LEGACY = ['shouba', 'bazzi', 'qumbul', 'qaloon', 'doori', 'soosi'];
const ANNOTATION_TABLES = ['bookmarks', 'notes', 'highlights'];

// Empty orphan left by the PK-autoindex "drop UNIQUE" migration on real
// devices. Tolerated in both directions: develop may create it, keep it, or
// (after the production fix) drop it.
const TOLERATED_TABLES = ['verse-annotations.db/notes_new'];

// The only documented changes develop may make to pre-existing values on
// upgrade: rewayah ids are renamed from legacy slugs and NULL is backfilled
// to 'hafs'. Every other pre-existing column must be byte-equal.
function mapRewayah(value: unknown): unknown {
  if (value === null) return 'hafs';
  if (typeof value !== 'string') return value;
  return PERSISTED_ID_MIGRATIONS[value] ?? value;
}
const MAPPED: Record<string, (before: unknown) => unknown> = {
  'verse-annotations.db/bookmarks.rewayah_id': mapRewayah,
  'verse-annotations.db/notes.rewayah_id': mapRewayah,
  'verse-annotations.db/highlights.rewayah_id': mapRewayah,
};
// Columns develop may add to an existing table, with the value existing rows
// must get.
const ADDED: Record<string, unknown> = {
  'verse-annotations.db/bookmarks.rewayah_id': 'hafs',
  'verse-annotations.db/notes.rewayah_id': 'hafs',
  'verse-annotations.db/highlights.rewayah_id': 'hafs',
};

// Seeded rewayah id per bookmark index (see scripts/golden-dbs/populate.golden.ts)
// as develop must expose it: legacy slugs renamed, NULL backfilled to hafs.
const BOOKMARK_REWAYAH = [
  'hafs',
  'warsh',
  'shubah',
  'al-bazzi',
  'qunbul',
  'qalun',
  'al-duri-abi-amr',
  'al-susi',
  'shubah',
  'al-bazzi',
  'qunbul',
  'qalun',
  'al-duri-abi-amr',
  'al-susi',
  'hafs',
];

function want(tag: string, seeded: string): string {
  return tag === PRE_REWAYAH_TAG ? 'hafs' : seeded;
}

function loadServices(copyTag: string | null, shared?: MockModule): Services {
  let result: Services | undefined;
  jest.isolateModules(() => {
    let mock: MockModule;
    if (shared) {
      jest.doMock('expo-sqlite', () => shared.expoSqliteModule);
      mock = shared;
    } else {
      mock = require('@/test-utils/mockExpoSqlite');
    }
    if (copyTag) copyGoldenInto(copyTag, mock.databaseDir());
    result = {
      mock,
      annotations: require('../VerseAnnotationDatabaseService')
        .verseAnnotationDatabaseService,
      playlists: require('../DatabaseService').databaseService,
      tafseer: require('@/services/tafseer/TafseerDbService').tafseerDbService,
      translations: require('@/services/translation/TranslationDbService')
        .translationDbService,
      adhkar: require('@/services/adhkar/AdhkarService').adhkarService,
      adhkarDb: require('../AdhkarDatabaseService').adhkarDatabaseService,
      uploads: require('@/services/uploads/UploadsDatabaseService')
        .uploadsDatabaseService,
    };
  });
  // doMock registers globally: restore the default factory so later
  // registries get their own fresh mock directory.
  if (shared) {
    jest.doMock(
      'expo-sqlite',
      () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
    );
  }
  if (!result) throw new Error('services not loaded');
  return result;
}

// What AppInitializer runs for these databases on launch (uploadsService and
// AdhkarService delegate to the database services used here).
async function initAll(s: Services): Promise<void> {
  await s.annotations.initialize();
  await s.playlists.initialize();
  await s.tafseer.initialize();
  await s.translations.initialize();
  await s.adhkar.initialize();
  await s.uploads.initialize();
}

// Reads the golden copy straight from disk, before any develop code runs.
async function dumpFiles(dir: string, files: string[]): Promise<Dump> {
  const dump: Dump = {};
  for (const file of files) {
    const db = openAdapterDatabase(path.join(dir, file));
    for (const name of await listTables(db)) {
      dump[`${file}/${name}`] = {
        pk: await primaryKey(db, name),
        rows: await readTable(db, name),
      };
    }
    await db.closeAsync();
  }
  return dump;
}

// Reads through the same handles develop's services hold.
async function dumpAll(mock: MockModule, files: string[]): Promise<Dump> {
  const dump: Dump = {};
  for (const file of files) {
    const db = await mock.openDatabaseAsync(file);
    for (const name of await listTables(db)) {
      dump[`${file}/${name}`] = {
        pk: await primaryKey(db, name),
        rows: await readTable(db, name),
      };
    }
  }
  return dump;
}

function pkOf(row: Row, pk: string[]): string {
  return JSON.stringify(pk.map(c => row[c]));
}

function manifestKey(dumpKey: string): string {
  return dumpKey.replace('.db/', '/');
}

function rewayahValues(dump: Dump, table: string): unknown[] {
  const t = dump[`verse-annotations.db/${table}`];
  if (!t) return [];
  return t.rows.map(r => r.rewayah_id);
}

describe.each(TAGS)('develop code on %s databases', tag => {
  let s: Services;
  let files: string[];
  let before: Dump;
  let after: Dump;

  beforeAll(async () => {
    files = goldenDbFiles(tag);
    s = loadServices(tag);
    before = await dumpFiles(s.mock.databaseDir(), files);
    await initAll(s);
    after = await dumpAll(s.mock, files);
  });

  afterAll(async () => {
    await s.annotations.close();
    await s.playlists.close();
    await s.adhkarDb.close();
    await s.uploads.close();
    await s.mock.resetDatabases();
  });

  it('sanity: the golden copy matches its manifest before develop runs', () => {
    const manifest = goldenManifest(tag);
    expect(files).toEqual([
      'adhkar.db',
      'playlists.db',
      'tafaseer.db',
      'translations.db',
      'uploads.db',
      'verse-annotations.db',
    ]);
    const counts: Record<string, number> = {};
    for (const [key, t] of Object.entries(before)) {
      counts[manifestKey(key)] = t.rows.length;
    }
    expect(counts).toEqual(manifest.tables);
    expect(manifest.tables['verse-annotations/bookmarks']).toBe(15);
    for (const key of DIGEST_TABLES) {
      expect(rowsDigest(before[key.replace('/', '.db/')].rows)).toBe(
        manifest.digests[key],
      );
    }
  });

  it('keeps the row count of every golden table', () => {
    const manifest = goldenManifest(tag);
    for (const [key, count] of Object.entries(manifest.tables)) {
      const dumpKey = key.replace('/', '.db/');
      if (TOLERATED_TABLES.includes(dumpKey)) {
        expect(after[dumpKey]?.rows ?? []).toHaveLength(0);
        continue;
      }
      expect({table: key, rows: after[dumpKey]?.rows.length}).toEqual({
        table: key,
        rows: count,
      });
    }
  });

  it('preserves every pre-existing row and column, except documented mappings', () => {
    for (const [key, pre] of Object.entries(before)) {
      if (TOLERATED_TABLES.includes(key)) continue;
      const post = after[key];
      expect(post).toBeDefined();
      if (!post) continue;
      expect(post.pk).toEqual(pre.pk);
      expect(post.pk.length).toBeGreaterThan(0);
      const postByPk = new Map(post.rows.map(r => [pkOf(r, post.pk), r]));
      expect(postByPk.size).toBe(pre.rows.length);
      for (const row of pre.rows) {
        const id = pkOf(row, pre.pk);
        const got = postByPk.get(id);
        expect({table: key, id, found: got !== undefined}).toEqual({
          table: key,
          id,
          found: true,
        });
        if (!got) continue;
        const expected: Row = {};
        for (const [column, value] of Object.entries(row)) {
          const map = MAPPED[`${key}.${column}`];
          expected[column] = map ? map(value) : value;
        }
        for (const column of Object.keys(got)) {
          if (column in row) continue;
          const added = `${key}.${column}`;
          expect({added, documented: added in ADDED}).toEqual({
            added,
            documented: true,
          });
          expected[column] = ADDED[added];
        }
        expect({table: key, id, row: got}).toEqual({
          table: key,
          id,
          row: expected,
        });
      }
    }
  });

  it('keeps tafsir and translation content byte-identical', () => {
    const manifest = goldenManifest(tag);
    for (const key of DIGEST_TABLES) {
      const dumpKey = key.replace('/', '.db/');
      expect(after[dumpKey].rows).toHaveLength(manifest.tables[key]);
      expect({table: key, digest: rowsDigest(after[dumpKey].rows)}).toEqual({
        table: key,
        digest: manifest.digests[key],
      });
    }
  });

  it('maps every legacy and NULL rewayah id to a canonical one', () => {
    if (tag === FIRST_LAUNCH_TAG) {
      // Guard against a vacuous run: this golden must carry every legacy
      // slug and NULL, or the mapping below proves nothing.
      const bookmarks = rewayahValues(before, 'bookmarks');
      for (const legacy of LEGACY) expect(bookmarks).toContain(legacy);
      expect(bookmarks).toContain(null);
      expect(rewayahValues(before, 'notes')).toEqual(
        expect.arrayContaining(['shouba', 'qaloon', 'doori', null]),
      );
      expect(rewayahValues(before, 'highlights')).toContain(null);
    }
    for (const table of ANNOTATION_TABLES) {
      for (const value of rewayahValues(after, table)) {
        expect({table, value, canonical: isRewayahId(value)}).toEqual({
          table,
          value,
          canonical: true,
        });
      }
    }
  });

  it('tolerates the real-device notes_new orphan without losing notes', async () => {
    // Real devices end up with an empty orphan notes_new table: the "drop
    // UNIQUE" migration mistakes the PRIMARY KEY autoindex for a UNIQUE
    // constraint. Second-launch goldens carry it; develop may keep, create
    // or (once fixed) drop it, so only data integrity is asserted after init.
    const manifest = goldenManifest(tag);
    const orphan = before['verse-annotations.db/notes_new'];
    if (tag === FIRST_LAUNCH_TAG) {
      expect(orphan).toBeUndefined();
    } else {
      expect(orphan?.rows).toEqual([]);
    }
    expect(await s.annotations.getAllNotes()).toHaveLength(
      manifest.tables['verse-annotations/notes'],
    );
    expect(await s.annotations.getAllBookmarks()).toHaveLength(
      manifest.tables['verse-annotations/bookmarks'],
    );
    expect(await s.annotations.getHighlightsBySurah(1)).toHaveLength(
      manifest.tables['verse-annotations/highlights'],
    );
  });

  it('keeps every bookmark with a valid canonical rewayah id', async () => {
    const manifest = goldenManifest(tag);
    const all = await s.annotations.getAllBookmarks();
    expect(all).toHaveLength(manifest.tables['verse-annotations/bookmarks']);
    const byKey = new Map(all.map(b => [b.verseKey, b]));
    BOOKMARK_REWAYAH.forEach((expected, i) => {
      const surah = SURAHS[i % SURAHS.length];
      const bookmark = byKey.get(`${surah}:${i + 1}`);
      expect(bookmark).toBeDefined();
      expect(bookmark?.surahNumber).toBe(surah);
      expect(bookmark?.ayahNumber).toBe(i + 1);
      expect(bookmark?.rewayahId).toBe(want(tag, expected));
    });
    for (const b of all) {
      expect(isRewayahId(b.rewayahId)).toBe(true);
      expect(String(b.rewayahId)).not.toMatch(/^al-al-/);
    }
  });

  it('keeps every note with exact bodies and valid rewayah ids', async () => {
    const manifest = goldenManifest(tag);
    const all = await s.annotations.getAllNotes();
    expect(all).toHaveLength(manifest.tables['verse-annotations/notes']);
    const byKey = new Map(all.map(n => [n.verseKey, n]));
    expect(byKey.get('1:1')?.content).toBe('Edited note body');
    expect(byKey.get('1:1')?.rewayahId).toBe(want(tag, 'hafs'));
    expect(byKey.get('2:255')?.content).toBe('Ayat al-Kursi reflection');
    expect(byKey.get('2:255')?.rewayahId).toBe(want(tag, 'warsh'));
    expect(byKey.get('2:1')?.content).toBe('Multi verse note');
    expect(byKey.get('2:1')?.verseKeys).toEqual(['2:1', '2:2', '2:3']);
    expect(byKey.get('2:1')?.rewayahId).toBe(want(tag, 'shubah'));
    expect(byKey.get('18:10')?.content).toBe('x'.repeat(5000));
    expect(byKey.get('18:10')?.rewayahId).toBe(want(tag, 'hafs'));
    expect(byKey.get('114:1')?.content).toBe(
      'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ \u{1F54B}\u{2728}',
    );
    expect(byKey.get('114:1')?.rewayahId).toBe(want(tag, 'al-duri-abi-amr'));
    expect(byKey.get('1:2')?.content).toBe('Original text');
    expect(byKey.get('1:2')?.rewayahId).toBe(want(tag, 'qalun'));
    for (const n of all) {
      expect(isRewayahId(n.rewayahId)).toBe(true);
    }
  });

  it('keeps every highlight with color and valid rewayah id', async () => {
    const manifest = goldenManifest(tag);
    const hs = await s.annotations.getHighlightsBySurah(1);
    expect(hs).toHaveLength(manifest.tables['verse-annotations/highlights']);
    const colors = ['yellow', 'green', 'blue', 'orange', 'purple'];
    const byKey = new Map(hs.map(h => [h.verseKey, h]));
    colors.forEach((color, i) => {
      const h = byKey.get(`1:${i + 1}`);
      expect(h?.color).toBe(color);
      expect(h?.rewayahId).toBe('hafs');
    });
  });

  it('keeps playlists and items intact with order', async () => {
    const manifest = goldenManifest(tag);
    const lists = await s.playlists.getAllPlaylists();
    expect(lists).toHaveLength(manifest.tables['playlists/user_playlists']);
    const p1 = lists.find(p => p.id === 'playlist-1');
    expect(p1?.name).toBe('Golden playlist 1');
    expect(p1?.description).toBe('First golden playlist');
    expect(p1?.color).toBe('#FF0000');
    expect(p1?.itemCount).toBe(3);
    const p2 = lists.find(p => p.id === 'playlist-2');
    expect(p2?.name).toBe('Golden playlist 2');
    expect(p2?.color).toBe('#0000FF');
    expect(p2?.itemCount).toBe(3);

    let total = 0;
    for (const p of [1, 2]) {
      const items = await s.playlists.getPlaylistItems(`playlist-${p}`);
      total += items.length;
      // develop returns items ordered by order_index DESC
      expect(items.map(i => i.orderIndex)).toEqual([2, 1, 0]);
      expect(items.map(i => i.id)).toEqual([
        `item-${p}-2`,
        `item-${p}-1`,
        `item-${p}-0`,
      ]);
      expect(items.map(i => i.surahId)).toEqual(['3', '2', '1']);
      expect(items.every(i => i.reciterId === `reciter-${p}`)).toBe(true);
      expect(items[2].rewayatId).toBe('hafs');
      expect(items[1].rewayatId).toBeUndefined();
    }
    expect(total).toBe(manifest.tables['playlists/playlist_items']);
    const second = await s.playlists.getPlaylistItems('playlist-2');
    expect(second[1].userRecitationId).toBe('user-recitation-1');
  });

  it('serves seeded tafsir text and group ranges', async () => {
    const meta = await s.tafseer.getDownloadedTafaseer();
    expect(meta.map(m => m.identifier).sort()).toEqual(['16', '169']);
    expect(await s.tafseer.getTafseerForVerse('1:2', '169')).toEqual({
      text: 'synthetic 1:2',
      fromAyah: 2,
      toAyah: 2,
      surahNumber: 1,
    });
    const group = {
      text: 'synthetic group 2:1-3',
      fromAyah: 1,
      toAyah: 3,
      surahNumber: 2,
    };
    expect(await s.tafseer.getTafseerForVerse('2:2', '169')).toEqual(group);
    expect(await s.tafseer.getTafseerForVerse('2:3', '169')).toEqual(group);
    expect((await s.tafseer.getTafseerForVerse('2:4', '169'))?.text).toBe(
      'synthetic 2:4',
    );
    for (const a of [1, 2, 3, 4, 5]) {
      expect((await s.tafseer.getTafseerForVerse(`1:${a}`, '16'))?.text).toBe(
        `synthetic B 1:${a}`,
      );
    }
  });

  it('still lists downloaded translations with their verses', async () => {
    const list = await s.translations.getDownloadedTranslations();
    expect(list).toHaveLength(1);
    expect(list[0].identifier).toBe('en.itani');
    expect(list[0].verseCount).toBe(10);
    expect(await s.translations.isDownloaded('en.itani')).toBe(true);
    const verses = await s.translations.getAllVerses('en.itani');
    expect(Object.keys(verses)).toHaveLength(10);
    expect(verses['1:7']).toBe('synthetic translation 1:7');
  });

  it('keeps adhkar favorites and tasbeeh counts', async () => {
    const manifest = goldenManifest(tag);
    const saved = await s.adhkarDb.getSaved();
    expect(saved).toHaveLength(manifest.tables['adhkar/dhikr_favorites']);
    expect(saved.map(f => f.dhikrId).sort()).toEqual(
      before['adhkar.db/dhikr_favorites'].rows.map(r => r.dhikr_id).sort(),
    );
    // Read raw rows: getDhikrCount() resets counts from an earlier day.
    expect(after['adhkar.db/dhikr_counts'].rows).toEqual(
      before['adhkar.db/dhikr_counts'].rows,
    );
    expect(after['adhkar.db/dhikr_counts'].rows.map(r => r.count)).toEqual(
      expect.arrayContaining([33, 7]),
    );
  });

  it('keeps uploaded recitations and custom reciters', async () => {
    const manifest = goldenManifest(tag);
    const all = await s.uploads.getAll();
    expect(all).toHaveLength(manifest.tables['uploads/uploaded_recitations']);
    const first = await s.uploads.getById('user-recitation-1');
    expect(first).toMatchObject({
      filePath: 'user-recitation-1.mp3',
      originalFilename: 'fatiha.m4a',
      duration: 123,
      type: 'surah',
      surahNumber: 1,
      reciterId: 'reciter-1',
      isPersonal: false,
      rewayah: 'hafs',
      style: 'murattal',
      recordingType: 'studio',
    });
    const other = await s.uploads.getById('user-recitation-2');
    expect(other).toMatchObject({
      type: 'other',
      title: 'Synthetic dua',
      category: 'dua',
      customReciterId: 'custom-reciter-1',
      isPersonal: true,
      recordingType: 'salah',
    });
    expect((await s.uploads.getUntagged()).map(r => r.id)).toEqual([
      'user-recitation-3',
    ]);
    const reciters = await s.uploads.getAllCustomReciters();
    expect(reciters).toHaveLength(manifest.tables['uploads/custom_reciters']);
    expect(reciters[0]).toMatchObject({
      id: 'custom-reciter-1',
      name: 'Synthetic Reciter',
      imageUri: null,
    });
  });

  it('is idempotent: a second initialize changes nothing', async () => {
    const first = await dumpAll(s.mock, files);
    expect(Object.keys(first).length).toBeGreaterThan(0);
    const second = loadServices(null, s.mock);
    await initAll(second);
    expect(await dumpAll(s.mock, files)).toEqual(first);
  });
});
