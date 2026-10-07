import fs from 'fs';
import path from 'path';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {adhkarDatabaseService} from '@/services/database/AdhkarDatabaseService';
import {databaseService} from '@/services/database/DatabaseService';
import {verseAnnotationDatabaseService as annotations} from '@/services/database/VerseAnnotationDatabaseService';
import {tafseerDbService} from '@/services/tafseer/TafseerDbService';
import {translationDbService} from '@/services/translation/TranslationDbService';
import {uploadsDatabaseService} from '@/services/uploads/UploadsDatabaseService';
import {
  DIGEST_TABLES,
  listTables,
  readTable,
  rowsDigest,
} from '@/test-utils/goldenDb';
import {
  closeOpenDatabases,
  databaseDir,
  resetDatabases,
} from '@/test-utils/mockExpoSqlite';
import {openAdapterDatabase} from '@/test-utils/sqliteAdapter';

const CANONICAL = [
  'hafs',
  'warsh',
  'shubah',
  'al-bazzi',
  'qunbul',
  'qalun',
  'al-duri-abi-amr',
  'al-susi',
];
const LEGACY = ['shouba', 'bazzi', 'qumbul', 'qaloon', 'doori', 'soosi'];
const SURAHS = [1, 2, 18, 114];
const COLORS = ['yellow', 'green', 'blue', 'orange', 'purple'] as const;
const DB_FILES = [
  'verse-annotations.db',
  'playlists.db',
  'tafaseer.db',
  'translations.db',
  'adhkar.db',
  'uploads.db',
];
// GOLDEN_FIRST_LAUNCH=1 stops after the first launch: rows keep the rewayah
// ids exactly as the release wrote them (legacy slugs and NULL), before the
// release's own relaunch migrations rewrite them.
const FIRST_LAUNCH = process.env.GOLDEN_FIRST_LAUNCH === '1';

type AnnotationsModule =
  typeof import('@/services/database/VerseAnnotationDatabaseService');
type PlaylistsModule = typeof import('@/services/database/DatabaseService');
type TafseerModule = typeof import('@/services/tafseer/TafseerDbService');
type TranslationModule =
  typeof import('@/services/translation/TranslationDbService');
type AdhkarModule = typeof import('@/services/adhkar/AdhkarService');
type UploadsModule = typeof import('@/services/uploads/UploadsDatabaseService');
type SqliteMockModule = typeof import('@/test-utils/mockExpoSqlite');

describe('golden database generation', () => {
  it('populates', async () => {
    const skipped: string[] = [];
    const dir = databaseDir();

    await annotations.initialize();
    // Releases before v2.2.0 have no rewayah support: their methods take no
    // rewayah argument. Only pass one when the release method declares it.
    const hasRewayah = annotations.addBookmark.length >= 4;
    if (!hasRewayah) {
      skipped.push('rewayahId args: release has no rewayah_id column');
    }
    const rw = (id: string | undefined): string | undefined =>
      hasRewayah ? id : undefined;
    // Bookmarks have UNIQUE(verse_key): distinct verse per rewayah id.
    const ids: Array<string | undefined> = [...CANONICAL, ...LEGACY, undefined];
    for (let i = 0; i < ids.length; i++) {
      const surah = SURAHS[i % SURAHS.length];
      const ayah = i + 1;
      await annotations.addBookmark(
        `${surah}:${ayah}`,
        surah,
        ayah,
        rw(ids[i]),
      );
    }

    const long = 'x'.repeat(5000);
    const n1 = await annotations.addNote(
      '1:1',
      1,
      1,
      'Plain note',
      undefined,
      rw('hafs'),
    );
    await annotations.addNote(
      '2:255',
      2,
      255,
      'Ayat al-Kursi reflection',
      undefined,
      rw('warsh'),
    );
    await annotations.addNote(
      '2:1',
      2,
      1,
      'Multi verse note',
      ['2:1', '2:2', '2:3'],
      rw('shouba'),
    );
    await annotations.addNote('18:10', 18, 10, long);
    await annotations.addNote(
      '114:1',
      114,
      1,
      'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ \u{1F54B}\u{2728}',
      undefined,
      rw('doori'),
    );
    await annotations.addNote(
      '1:2',
      1,
      2,
      'Original text',
      undefined,
      rw('qaloon'),
    );
    await annotations.updateNote(n1.id, 'Edited note body');

    if (typeof annotations.upsertHighlight === 'function') {
      for (let i = 0; i < COLORS.length; i++) {
        await annotations.upsertHighlight(
          `1:${i + 1}`,
          1,
          i + 1,
          COLORS[i],
          rw(i % 2 === 0 ? 'hafs' : undefined),
        );
      }
    } else {
      skipped.push('highlights: upsertHighlight missing in release');
    }

    await databaseService.initialize();
    const now = Date.now();
    for (let p = 1; p <= 2; p++) {
      await databaseService.createPlaylist({
        id: `playlist-${p}`,
        name: `Golden playlist ${p}`,
        description: p === 1 ? 'First golden playlist' : undefined,
        color: p === 1 ? '#FF0000' : '#0000FF',
        createdAt: now,
        updatedAt: now,
      });
      for (let i = 0; i < 3; i++) {
        await databaseService.addPlaylistItem({
          id: `item-${p}-${i}`,
          playlistId: `playlist-${p}`,
          surahId: String(i + 1),
          reciterId: `reciter-${p}`,
          rewayatId: i === 0 ? 'hafs' : undefined,
          orderIndex: i,
          addedAt: now,
          userRecitationId:
            p === 2 && i === 1 ? 'user-recitation-1' : undefined,
        });
      }
    }

    await tafseerDbService.initialize();
    await tafseerDbService.saveTafseer(
      '169',
      'Synthetic Tafsir',
      'Synthetic Tafsir',
      'ar',
      'rtl',
      [
        {verseKey: '1:1', surahNumber: 1, ayahNumber: 1, text: 'synthetic 1:1'},
        {verseKey: '1:2', surahNumber: 1, ayahNumber: 2, text: 'synthetic 1:2'},
        {verseKey: '1:3', surahNumber: 1, ayahNumber: 3, text: 'synthetic 1:3'},
        {
          verseKey: '2:1',
          surahNumber: 2,
          ayahNumber: 1,
          text: 'synthetic group 2:1-3',
          groupVerseKey: '2:1',
          fromAyah: 1,
          toAyah: 3,
        },
        {
          verseKey: '2:2',
          surahNumber: 2,
          ayahNumber: 2,
          text: 'synthetic group 2:1-3',
          groupVerseKey: '2:1',
          fromAyah: 1,
          toAyah: 3,
        },
        {
          verseKey: '2:3',
          surahNumber: 2,
          ayahNumber: 3,
          text: 'synthetic group 2:1-3',
          groupVerseKey: '2:1',
          fromAyah: 1,
          toAyah: 3,
        },
        {verseKey: '2:4', surahNumber: 2, ayahNumber: 4, text: 'synthetic 2:4'},
      ],
    );
    await tafseerDbService.saveTafseer(
      '16',
      'Synthetic Tafsir B',
      'Synthetic Tafsir B',
      'ar',
      'rtl',
      [1, 2, 3, 4, 5].map(a => ({
        verseKey: `1:${a}`,
        surahNumber: 1,
        ayahNumber: a,
        text: `synthetic B 1:${a}`,
      })),
    );

    await translationDbService.initialize();
    await translationDbService.saveTranslation(
      'en.itani',
      'Synthetic Translation',
      'Synthetic Translation',
      'en',
      'ltr',
      Array.from({length: 10}, (_, i) => ({
        verseKey: `1:${i + 1}`,
        surahNumber: 1,
        ayahNumber: i + 1,
        text: `synthetic translation 1:${i + 1}`,
      })),
    );

    // Adhkar: the release seeds its bundled adhkar content on first launch;
    // the user data is favorites and tasbeeh counts.
    await adhkarService.initialize();
    const categories = await adhkarDatabaseService.getAllCategories();
    const adhkar = await adhkarDatabaseService.getAdhkarByCategoryIds(
      categories.map(c => c.id),
    );
    if (adhkar.length < 3) throw new Error('release seeded too few adhkar');
    await adhkarDatabaseService.toggleSaved(adhkar[0].id);
    await adhkarDatabaseService.toggleSaved(adhkar[1].id);
    await adhkarDatabaseService.updateDhikrCount(adhkar[0].id, 33);
    await adhkarDatabaseService.updateDhikrCount(adhkar[2].id, 7);

    // Uploads: user recordings (tagged surah, tagged other with a custom
    // reciter, untagged) and one custom reciter. user-recitation-1 is the id
    // the second playlist references.
    await uploadsDatabaseService.initialize();
    await uploadsDatabaseService.insertCustomReciter({
      id: 'custom-reciter-1',
      name: 'Synthetic Reciter',
      imageUri: null,
      createdAt: now,
    });
    await uploadsDatabaseService.insertRecitation({
      id: 'user-recitation-1',
      filePath: 'user-recitation-1.mp3',
      originalFilename: 'fatiha.m4a',
      duration: 123,
      dateAdded: now,
      type: 'surah',
      surahNumber: 1,
      startVerse: null,
      endVerse: null,
      title: null,
      category: null,
      reciterId: 'reciter-1',
      customReciterId: null,
      isPersonal: false,
      rewayah: 'hafs',
      style: 'murattal',
      recordingType: 'studio',
    });
    await uploadsDatabaseService.insertRecitation({
      id: 'user-recitation-2',
      filePath: 'user-recitation-2.mp3',
      originalFilename: 'dua.mp3',
      duration: 45,
      dateAdded: now + 1,
      type: 'other',
      surahNumber: null,
      startVerse: null,
      endVerse: null,
      title: 'Synthetic dua',
      category: 'dua',
      reciterId: null,
      customReciterId: 'custom-reciter-1',
      isPersonal: true,
      rewayah: null,
      style: null,
      recordingType: 'salah',
    });
    await uploadsDatabaseService.insertRecitation({
      id: 'user-recitation-3',
      filePath: 'user-recitation-3.mp3',
      originalFilename: 'untagged.wav',
      duration: null,
      dateAdded: now + 2,
      type: null,
      surahNumber: null,
      startVerse: null,
      endVerse: null,
      title: null,
      category: null,
      reciterId: null,
      customReciterId: null,
      isPersonal: false,
      rewayah: null,
      style: null,
      recordingType: null,
    });

    await closeOpenDatabases();
    let sqliteForCopy: SqliteMockModule | null = null;
    if (FIRST_LAUNCH) {
      skipped.push('second launch: first-launch variant');
    } else {
      sqliteForCopy = await relaunch(dir);
    }
    // Close every handle (checkpoints WAL), then copy the files out.
    if (sqliteForCopy) await sqliteForCopy.closeOpenDatabases();
    await resetDatabases();

    const out = process.env.GOLDEN_OUT;
    if (!out) throw new Error('GOLDEN_OUT not set');
    fs.mkdirSync(out, {recursive: true});
    const tables: Record<string, number> = {};
    const digests: Record<string, string> = {};
    for (const file of DB_FILES) {
      const src = path.join(dir, file);
      fs.copyFileSync(src, path.join(out, file));
      const db = openAdapterDatabase(path.join(out, file));
      // Rollback journal on disk: opening a golden never needs sidecars.
      await db.execAsync('PRAGMA journal_mode = DELETE;');
      for (const name of await listTables(db)) {
        const key = `${file.replace('.db', '')}/${name}`;
        const rows = await readTable(db, name);
        tables[key] = rows.length;
        if (DIGEST_TABLES.includes(key)) digests[key] = rowsDigest(rows);
      }
      await db.closeAsync();
    }
    for (const f of fs.readdirSync(out)) {
      if (f.endsWith('-wal') || f.endsWith('-shm') || f.endsWith('-journal'))
        fs.rmSync(path.join(out, f));
    }
    fs.writeFileSync(
      path.join(out, 'manifest.json'),
      JSON.stringify(
        {
          tag: process.env.GOLDEN_TAG,
          variant: FIRST_LAUNCH ? 'first-launch' : 'second-launch',
          commit: process.env.GOLDEN_COMMIT,
          generated_at: new Date().toISOString(),
          tables,
          digests,
          skipped,
        },
        null,
        2,
      ) + '\n',
    );
  });
});

// Simulate a second app launch: load a fresh copy of the release modules (new
// singletons) and run each service's own initialize() again over the same
// files. Real devices hit this state on every launch after the first (e.g.
// the orphan notes_new table). Returns the mock module that owns the handles.
async function relaunch(dir: string): Promise<SqliteMockModule> {
  jest.resetModules();
  const sqliteAfterReset = jest.requireActual<SqliteMockModule>(
    '@/test-utils/mockExpoSqlite',
  );
  sqliteAfterReset.useDatabaseDir(dir);
  const annotationsAgain = jest.requireActual<AnnotationsModule>(
    '@/services/database/VerseAnnotationDatabaseService',
  ).verseAnnotationDatabaseService;
  const playlists = jest.requireActual<PlaylistsModule>(
    '@/services/database/DatabaseService',
  ).databaseService;
  const tafseer = jest.requireActual<TafseerModule>(
    '@/services/tafseer/TafseerDbService',
  ).tafseerDbService;
  const translation = jest.requireActual<TranslationModule>(
    '@/services/translation/TranslationDbService',
  ).translationDbService;
  const adhkarAgain = jest.requireActual<AdhkarModule>(
    '@/services/adhkar/AdhkarService',
  ).adhkarService;
  const uploads = jest.requireActual<UploadsModule>(
    '@/services/uploads/UploadsDatabaseService',
  ).uploadsDatabaseService;
  await annotationsAgain.initialize();
  await playlists.initialize();
  await tafseer.initialize();
  await translation.initialize();
  await adhkarAgain.initialize();
  await uploads.initialize();
  return sqliteAfterReset;
}
