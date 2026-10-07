import fs from 'fs';
import path from 'path';
import {databaseService} from '@/services/database/DatabaseService';
import {verseAnnotationDatabaseService as annotations} from '@/services/database/VerseAnnotationDatabaseService';
import {tafseerDbService} from '@/services/tafseer/TafseerDbService';
import {translationDbService} from '@/services/translation/TranslationDbService';
import {databaseDir, resetDatabases} from '@/test-utils/mockExpoSqlite';
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
];

interface NameRow {
  name: string;
}
interface CountRow {
  n: number;
}

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

    // Close every handle (checkpoints WAL), then copy the files out.
    await annotations.close();
    await databaseService.close();
    await resetDatabases();

    const out = process.env.GOLDEN_OUT;
    if (!out) throw new Error('GOLDEN_OUT not set');
    fs.mkdirSync(out, {recursive: true});
    const tables: Record<string, number> = {};
    for (const file of DB_FILES) {
      const src = path.join(dir, file);
      fs.copyFileSync(src, path.join(out, file));
      const db = openAdapterDatabase(path.join(out, file));
      const names = await db.getAllAsync<NameRow>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      );
      for (const {name} of names) {
        const row = await db.getFirstAsync<CountRow>(
          `SELECT COUNT(*) AS n FROM "${name}"`,
        );
        tables[`${file.replace('.db', '')}/${name}`] = row?.n ?? 0;
      }
      await db.closeAsync();
    }
    for (const f of fs.readdirSync(out)) {
      if (f.endsWith('-wal') || f.endsWith('-shm'))
        fs.rmSync(path.join(out, f));
    }
    fs.writeFileSync(
      path.join(out, 'manifest.json'),
      JSON.stringify(
        {
          tag: process.env.GOLDEN_TAG,
          commit: process.env.GOLDEN_COMMIT,
          generated_at: new Date().toISOString(),
          tables,
          skipped,
        },
        null,
        2,
      ) + '\n',
    );
  });
});
