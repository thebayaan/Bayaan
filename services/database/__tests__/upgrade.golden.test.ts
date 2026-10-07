jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import {copyGoldenInto, goldenManifest} from '@/test-utils/goldenDb';
import {isRewayahId} from '@/services/rewayah/RewayahIdentity';

type MockModule = typeof import('@/test-utils/mockExpoSqlite');
type Annotations =
  typeof import('../VerseAnnotationDatabaseService').verseAnnotationDatabaseService;
type Playlists = typeof import('../DatabaseService').databaseService;
type Tafseer =
  typeof import('@/services/tafseer/TafseerDbService').tafseerDbService;
type Translations =
  typeof import('@/services/translation/TranslationDbService').translationDbService;

interface Services {
  mock: MockModule;
  annotations: Annotations;
  playlists: Playlists;
  tafseer: Tafseer;
  translations: Translations;
}

interface NameRow {
  name: string;
}

const TAGS = ['v2.3.0', 'v2.2.1', 'v2.1.2'];
// v2.1.2 predates rewayah_id: develop adds the column and backfills 'hafs'.
const PRE_REWAYAH_TAG = 'v2.1.2';
const SURAHS = [1, 2, 18, 114];
const DB_FILES = [
  'verse-annotations.db',
  'playlists.db',
  'tafaseer.db',
  'translations.db',
];

// Seeded rewayah id per bookmark index (see scripts/golden-dbs/populate.golden.ts)
// after develop's migrations: legacy slugs renamed, NULL backfilled to hafs.
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

async function initAll(s: Services): Promise<void> {
  await s.annotations.initialize();
  await s.playlists.initialize();
  await s.tafseer.initialize();
  await s.translations.initialize();
}

async function dumpAll(mock: MockModule): Promise<Record<string, unknown[]>> {
  const dump: Record<string, unknown[]> = {};
  for (const file of DB_FILES) {
    const db = await mock.openDatabaseAsync(file);
    const names = await db.getAllAsync<NameRow>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    for (const {name} of names) {
      dump[`${file}/${name}`] = await db.getAllAsync(
        `SELECT * FROM "${name}" ORDER BY rowid`,
      );
    }
  }
  return dump;
}

describe.each(TAGS)('develop code on %s databases', tag => {
  let s: Services;

  beforeAll(async () => {
    s = loadServices(tag);
    await initAll(s);
  });

  afterAll(async () => {
    await s.annotations.close();
    await s.playlists.close();
    await s.mock.resetDatabases();
  });

  it('sanity: the golden copy is visible, not an empty database', async () => {
    const manifest = goldenManifest(tag);
    expect(manifest.tables['verse-annotations/bookmarks']).toBe(15);
    expect((await s.annotations.getAllBookmarks()).length).toBeGreaterThan(0);
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
    expect((await s.tafseer.getTafseerForVerse('1:5', '16'))?.text).toBe(
      'synthetic B 1:5',
    );
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

  it('is idempotent: a second initialize changes nothing', async () => {
    const before = await dumpAll(s.mock);
    expect(Object.keys(before).length).toBeGreaterThan(0);
    const second = loadServices(null, s.mock);
    await initAll(second);
    const after = await dumpAll(s.mock);
    expect(after).toEqual(before);
  });
});
