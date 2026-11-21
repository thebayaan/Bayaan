/**
 * IrabDataService.getBooks over a copy of the bundled i'rab database: each
 * passage comes with its id, so the verses a book page discusses together
 * (100:1 to 100:5 share a page of each book) can show it once.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import {IRAB_DB_NAME} from '@/constants/bundledDatabases';
import {resetDatabases, useDatabaseDir} from '@/test-utils/mockExpoSqlite';
import {irabDataService} from '../IrabDataService';

jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);

jest.setTimeout(60_000);

const BUNDLED = path.join(__dirname, '../../../assets/data', IRAB_DB_NAME);
let dir = '';

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'irab-books-'));
  fs.copyFileSync(BUNDLED, path.join(dir, IRAB_DB_NAME));
  useDatabaseDir(dir);
});

afterAll(async () => {
  await resetDatabases();
  fs.rmSync(dir, {recursive: true, force: true});
});

/** The passage ids the database links to a verse, by book. */
function linked(verseKey: string): number[][] {
  const db = new Database(BUNDLED, {readonly: true});
  try {
    const rows = db
      .prepare(
        'SELECT book_id, passage_id FROM verse_passages WHERE verse_key = ? ORDER BY book_id, ord',
      )
      .all(verseKey) as {book_id: number; passage_id: number}[];
    const byBook = new Map<number, number[]>();
    for (const row of rows) {
      byBook.set(row.book_id, [
        ...(byBook.get(row.book_id) ?? []),
        row.passage_id,
      ]);
    }
    return [...byBook.values()];
  } finally {
    db.close();
  }
}

it('gives each passage its id, the same for every verse it discusses', async () => {
  const verses = ['100:1', '100:2', '100:3', '100:4', '100:5'];
  const ids = await Promise.all(
    verses.map(async verseKey =>
      (await irabDataService.getBooks(verseKey)).map(book =>
        book.passages.map(passage => passage.id),
      ),
    ),
  );
  expect(ids[0]).toEqual(linked('100:1'));
  expect(ids[0].flat()).toHaveLength(2);
  for (const other of ids.slice(1)) expect(other).toEqual(ids[0]);
});
