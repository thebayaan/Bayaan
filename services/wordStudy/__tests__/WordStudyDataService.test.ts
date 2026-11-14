// @ai-generated
import fs from 'fs';
import os from 'os';
import path from 'path';

jest.mock('expo-sqlite', () => {
  const m = require('@/test-utils/mockExpoSqlite').expoSqliteModule;
  return {
    openDatabaseAsync: jest.fn(m.openDatabaseAsync),
    importDatabaseFromAssetAsync: jest.fn(m.importDatabaseFromAssetAsync),
    deleteDatabaseAsync: jest.fn(m.deleteDatabaseAsync),
  };
});

import * as SQLite from 'expo-sqlite';
import {
  clearAssetFiles,
  databaseDir,
  registerAssetFile,
  resetDatabases,
} from '@/test-utils/mockExpoSqlite';
import {
  writeGharibDb,
  writeRasmDb,
  type GharibRow,
  type RasmRow,
} from '../../../scripts/word-study/db';
import {WordStudyDataService} from '../WordStudyDataService';
import {emptyVerseStudy, type WordStudySource} from '../wordStudyFormat';

const GHARIB_ASSET = 11;
const RASM_ASSET = 12;
const fixtures = fs.mkdtempSync(path.join(os.tmpdir(), 'word-study-fixtures-'));
const gharibFile = path.join(fixtures, 'gharib.db');
const rasmFile = path.join(fixtures, 'rasm.db');

const BOOK: WordStudySource = {
  id: 327,
  kind: 'gharib',
  ord: 1,
  nameAr: 'كتاب',
  nameEn: 'Book',
  authorAr: 'مؤلف',
  authorEn: 'Author',
  viaAr: 'ناشر',
  viaEn: 'Publisher',
  url: 'https://example.org',
  version: 'v1',
};

const row = (
  verseKey: string,
  ord: number,
  span: [number, number] | null,
  headword: string,
): GharibRow => ({
  verseKey,
  sourceId: 327,
  ord,
  span,
  tier: span ? 1 : 0,
  candidate: '',
  headword,
  gloss: `شرح ${headword}`,
  note: '',
  part: '',
  page: '',
});

const gharibRows: GharibRow[] = [
  row('1:4', 2, [2, 3], 'يوم الدين'),
  row('1:4', 1, [1, 1], 'مالك'),
  row('1:4', 3, null, 'كلمة'),
  // wbw numbering: word 4 of 2:181 is the word after بَعْدَ مَا (DK's 5).
  row('2:181', 4, [4, 4], 'سمعه'),
];

const rasmRows: RasmRow[] = [
  {
    verseKey: '2:3',
    from: 5,
    to: 5,
    imlaei: 'الصَّلَاةَ',
    notes: [
      {kind: 'badal', standard: 'ا', mushaf: 'و', mark: [5, 6], basis: 'sign'},
    ],
    reviewed: false,
  },
  {
    verseKey: '12:25',
    from: 9,
    to: 9,
    imlaei: 'لَدَى',
    notes: [
      {
        kind: 'badal',
        standard: 'ى',
        mushaf: 'ا',
        mark: null,
        basis: 'unconfirmed',
      },
    ],
    reviewed: false,
  },
];

const SHIPS = {
  gharib: {name: 'gharib-v1.db', assetId: GHARIB_ASSET, old: []},
  rasm: {name: 'rasm-v1.db', assetId: RASM_ASSET, old: []},
};

const mocked = SQLite as unknown as {
  openDatabaseAsync: jest.Mock;
  importDatabaseFromAssetAsync: jest.Mock;
  deleteDatabaseAsync: jest.Mock;
};

beforeAll(() => {
  writeGharibDb(gharibFile, [BOOK], gharibRows, {});
  writeRasmDb(rasmFile, {...BOOK, id: 1, kind: 'rasm'}, rasmRows, {});
});

afterAll(() => fs.rmSync(fixtures, {recursive: true, force: true}));

beforeEach(async () => {
  await resetDatabases();
  clearAssetFiles();
  registerAssetFile(GHARIB_ASSET, gharibFile);
  registerAssetFile(RASM_ASSET, rasmFile);
  jest.clearAllMocks();
});

it('reads as empty and opens nothing when nothing ships', async () => {
  const service = new WordStudyDataService({gharib: null, rasm: null});
  expect(service.ships('gharib')).toBe(false);
  expect(await service.getVerse('1:4')).toEqual(emptyVerseStudy('1:4'));
  expect(await service.getGharib('1:4:2')).toEqual([]);
  expect(await service.getRasm('2:3:5')).toBeNull();
  expect(mocked.openDatabaseAsync).not.toHaveBeenCalled();
});

it('imports each database once and caches each verse', async () => {
  const service = new WordStudyDataService(SHIPS);
  expect(service.ships('rasm')).toBe(true);
  const first = await service.getVerse('1:4');
  expect(first.gharib.map(e => e.ord)).toEqual([1, 2, 3]);
  expect(await service.getVerse('1:4')).toBe(first);
  await service.getVerse('2:3');
  expect(mocked.importDatabaseFromAssetAsync).toHaveBeenCalledTimes(2);
  // A new instance (an app relaunch) finds the imported files as they are.
  await new WordStudyDataService(SHIPS).getVerse('2:3');
  expect(mocked.importDatabaseFromAssetAsync).toHaveBeenCalledTimes(2);
});

it('reimports a database of another format and deletes the old names', async () => {
  // An earlier import under the same name, and an older name.
  const Database = require('better-sqlite3');
  const stale = new Database(path.join(databaseDir(), 'gharib-v1.db'));
  stale.exec(
    "CREATE TABLE meta (key TEXT, value TEXT); INSERT INTO meta VALUES ('format', '0');",
  );
  stale.close();
  fs.writeFileSync(path.join(databaseDir(), 'gharib-v0.db'), '');
  const service = new WordStudyDataService({
    gharib: {...SHIPS.gharib, old: ['gharib-v0.db', 'never-there.db']},
    rasm: null,
  });
  expect((await service.getGharib('1:4:2'))[0].headword).toBe('يوم الدين');
  expect(mocked.importDatabaseFromAssetAsync).toHaveBeenCalledTimes(1);
  expect(fs.existsSync(path.join(databaseDir(), 'gharib-v0.db'))).toBe(false);
});

it('reads as empty when a database cannot be opened, then tries again', async () => {
  clearAssetFiles();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const service = new WordStudyDataService(SHIPS);
  expect(await service.getVerse('2:3')).toEqual(emptyVerseStudy('2:3'));
  registerAssetFile(GHARIB_ASSET, gharibFile);
  registerAssetFile(RASM_ASSET, rasmFile);
  expect((await service.getVerse('2:3')).rasm).toHaveLength(1);
  warn.mockRestore();
});

it('gives a word its gharib entries with their source', async () => {
  const service = new WordStudyDataService(SHIPS);
  const [entry] = await service.getGharib('1:4:3');
  expect(entry).toMatchObject({
    verseKey: '1:4',
    ord: 2,
    span: [2, 3],
    headword: 'يوم الدين',
    gloss: 'شرح يوم الدين',
    source: {id: 327, kind: 'gharib', nameAr: 'كتاب', viaEn: 'Publisher'},
  });
  // Verse-level entries are in the verse, never on a word.
  const verse = await service.getVerse('1:4');
  expect(verse.gharib.find(e => e.ord === 3)?.span).toBeNull();
  expect(await service.getGharib('1:4:4')).toEqual([]);
});

it('gives a word its rasm unit, or null', async () => {
  const service = new WordStudyDataService(SHIPS);
  const salah = await service.getRasm('2:3:5');
  expect(salah?.notes).toEqual([
    {kind: 'badal', standard: 'ا', mushaf: 'و', mark: [5, 6], basis: 'sign'},
  ]);
  expect(salah?.source.kind).toBe('rasm');
  expect(await service.getRasm('2:9:4')).toBeNull();
  // Only hidden notes: no section.
  expect(await service.getRasm('12:25:9')).toBeNull();
});

it('uses the word-by-word numbering and ignores bad keys', async () => {
  const service = new WordStudyDataService(SHIPS);
  expect((await service.getGharib('2:181:4'))[0]?.headword).toBe('سمعه');
  expect(await service.getGharib('2:181')).toEqual([]);
  expect(await service.getRasm('nonsense')).toBeNull();
});
