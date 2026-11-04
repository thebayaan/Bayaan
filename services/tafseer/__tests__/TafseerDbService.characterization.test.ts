jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import crypto from 'crypto';
import {resetDatabases} from '@/test-utils/mockExpoSqlite';

interface BundledRow {
  verse_key: string;
  from_ayah: number | null;
  to_ayah: number | null;
  text: string;
}

type Service = typeof import('../TafseerDbService').tafseerDbService;
type MockModule = typeof import('@/test-utils/mockExpoSqlite');

function freshService(): Service {
  let service: Service | undefined;
  jest.isolateModules(() => {
    service = require('../TafseerDbService').tafseerDbService;
  });
  if (!service) throw new Error('service not loaded');
  return service;
}

// freshService() isolates the module (new instance); resetDatabases() gives each
// test an empty database directory so rows never leak between tests.
beforeEach(async () => {
  await resetDatabases();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TafseerDbService (characterization, develop behavior)', () => {
  it('saves and returns exact verse rows', async () => {
    const svc = freshService();
    await svc.initialize();
    await svc.saveTafseer('169', 'Ibn Kathir', 'Ibn Kathir', 'English', 'ltr', [
      {surahNumber: 1, ayahNumber: 1, verseKey: '1:1', text: '<p>a</p>'},
    ]);
    expect(await svc.getTafseerForVerse('1:1', '169')).toEqual({
      text: '<p>a</p>',
      fromAyah: 1,
      toAyah: 1,
      surahNumber: 1,
    });
  });

  it('serves grouped verses with the group range', async () => {
    const svc = freshService();
    await svc.initialize();
    const group = {text: 'G', groupVerseKey: '2:8', fromAyah: 8, toAyah: 10};
    await svc.saveTafseer('169', 'n', 'n', 'English', 'ltr', [
      {surahNumber: 2, ayahNumber: 7, verseKey: '2:7', text: 'seven'},
      {surahNumber: 2, ayahNumber: 8, verseKey: '2:8', ...group},
      {surahNumber: 2, ayahNumber: 9, verseKey: '2:9', ...group},
      {surahNumber: 2, ayahNumber: 10, verseKey: '2:10', ...group},
      {surahNumber: 2, ayahNumber: 11, verseKey: '2:11', text: 'eleven'},
    ]);
    const expected = {text: 'G', fromAyah: 8, toAyah: 10, surahNumber: 2};
    expect(await svc.getTafseerForVerse('2:9', '169')).toEqual(expected);
    expect(await svc.getTafseerForVerse('2:10', '169')).toEqual(expected);
    expect((await svc.getTafseerForVerse('2:7', '169'))?.text).toBe('seven');
    expect((await svc.getTafseerForVerse('2:11', '169'))?.text).toBe('eleven');
    expect(await svc.getTafseerForVerse('2:9', '16')).toBeNull();
  });

  it('falls back from beyond a group to the group row', async () => {
    const svc = freshService();
    await svc.initialize();
    const group = {text: 'G', groupVerseKey: '2:8', fromAyah: 8, toAyah: 10};
    await svc.saveTafseer('169', 'n', 'n', 'English', 'ltr', [
      {surahNumber: 2, ayahNumber: 7, verseKey: '2:7', text: 'seven'},
      {surahNumber: 2, ayahNumber: 8, verseKey: '2:8', ...group},
      {surahNumber: 2, ayahNumber: 10, verseKey: '2:10', ...group},
    ]);
    // 2:9 has no row of its own: nearest previous row is 2:8 (group G)
    expect(await svc.getTafseerForVerse('2:9', '169')).toEqual({
      text: 'G',
      fromAyah: 8,
      toAyah: 10,
      surahNumber: 2,
    });
  });

  it('falls back to the nearest previous verse in the same surah only', async () => {
    const svc = freshService();
    await svc.initialize();
    await svc.saveTafseer('169', 'n', 'n', 'English', 'ltr', [
      {surahNumber: 2, ayahNumber: 5, verseKey: '2:5', text: 'five'},
    ]);
    expect((await svc.getTafseerForVerse('2:7', '169'))?.text).toBe('five');
    expect(await svc.getTafseerForVerse('3:1', '169')).toBeNull();
    expect(await svc.getTafseerForVerse('2:1', '169')).toBeNull();
  });

  it('lists, reports and deletes downloads', async () => {
    const svc = freshService();
    await svc.initialize();
    await svc.saveTafseer('16', 'Muyassar', 'Muyassar', 'Arabic', 'rtl', [
      {surahNumber: 1, ayahNumber: 1, verseKey: '1:1', text: 'x'},
    ]);
    expect(await svc.isDownloaded('16')).toBe(true);
    expect((await svc.getDownloadedTafaseer()).map(t => t.identifier)).toEqual([
      '16',
    ]);
    await svc.deleteTafseer('16');
    expect(await svc.isDownloaded('16')).toBe(false);
  });

  // Bundled data has 5 fewer rows than QF's 6236; the content-sync parity check will name them.
  it('imports the bundled Ibn Kathir once with 6231 rows', async () => {
    // Load the service and the sqlite mock from the same isolated registry so
    // the raw query below reads the service's own database file.
    let svc: Service | undefined;
    let mock: MockModule | undefined;
    jest.isolateModules(() => {
      svc = require('../TafseerDbService').tafseerDbService;
      mock = require('@/test-utils/mockExpoSqlite');
    });
    if (!svc || !mock) throw new Error('service not loaded');
    await svc.initialize();
    await svc.importBundledIbnKathir();
    await svc.importBundledIbnKathir();
    expect(await svc.isDownloaded('169')).toBe(true);
    expect(Object.keys(await svc.getAllVerses('169'))).toHaveLength(6231);
    // Pin the expansion of the compact JSON: ranges and text per verse.
    const db = await mock.openDatabaseAsync('tafaseer.db');
    const rows = await db.getAllAsync<BundledRow>(
      "SELECT verse_key, from_ayah, to_ayah, text FROM tafaseer WHERE identifier = '169' ORDER BY surah_number, ayah_number",
    );
    expect(rows).toHaveLength(6231);
    const digest = crypto.createHash('sha256');
    for (const r of rows) {
      const text = crypto.createHash('sha256').update(r.text).digest('hex');
      digest.update(`${r.verse_key}|${r.from_ayah}|${r.to_ayah}|${text}\n`);
    }
    expect(digest.digest('hex')).toBe(
      '3f60d32d385627b7efc1b721b8113a526737ec5b0e24c5cbcb58e9b2547f0d22',
    );
  }, 60000);
});
