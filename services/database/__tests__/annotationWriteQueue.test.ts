// @ai-generated
// applyAnnotationChanges writes in a transaction on the app's one connection
// (withTransactionAsync is not exclusive). A write issued while that
// transaction is open must wait for it, not run inside it: there it would be
// undone by the transaction's ROLLBACK.
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import type {SqlParams} from '@/test-utils/sqliteAdapter';

type MockModule = typeof import('@/test-utils/mockExpoSqlite');
type Annotations =
  typeof import('../VerseAnnotationDatabaseService').verseAnnotationDatabaseService;

const DB_FILE = 'verse-annotations.db';

// Lets every pending promise callback and the next timer turn run.
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

describe('annotation writes', () => {
  let mock: MockModule;
  let annotations: Annotations;

  beforeEach(async () => {
    jest.resetModules();
    mock = require('@/test-utils/mockExpoSqlite');
    annotations =
      require('../VerseAnnotationDatabaseService').verseAnnotationDatabaseService;
    await annotations.initialize();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await annotations.close();
    await mock.resetDatabases();
  });

  it('a write issued while a change is open waits for it and is kept when it rolls back', async () => {
    const db = await mock.openDatabaseAsync(DB_FILE);
    await annotations.addBookmark('1:1', 1, 1, 'hafs');
    await annotations.addBookmark('8:8', 8, 8, 'hafs');
    await annotations.upsertHighlight('7:7', 7, 7, 'blue', 'hafs');
    const edited = await annotations.addNote('6:6', 6, 6, 'before');
    const deleted = await annotations.addNote('9:9', 9, 9, 'gone');
    // The change's insert fails, so its transaction rolls back.
    await db.execAsync(`
      CREATE TRIGGER fail_insert BEFORE INSERT ON bookmarks
      WHEN new.verse_key = '2:2'
      BEGIN SELECT RAISE(ABORT, 'disk I/O error'); END;
    `);

    // Once the change's transaction has run its first statement, issue one
    // of every other write and let everything that can run, run.
    const issued: Promise<unknown>[] = [];
    const run = db.runAsync.bind(db);
    jest
      .spyOn(db, 'runAsync')
      .mockImplementation(async (source: string, ...params: SqlParams) => {
        const result = await run(source, ...params);
        if (issued.length === 0 && source.startsWith('DELETE FROM bookmarks')) {
          issued.push(
            annotations.addNote('3:3', 3, 3, 'kept', undefined, 'warsh'),
            annotations.updateNote(edited.id, 'after'),
            annotations.addBookmark('4:4', 4, 4, 'hafs'),
            annotations.upsertHighlight('5:5', 5, 5, 'green', 'hafs'),
            annotations.removeHighlight('7:7'),
            annotations.removeBookmark('8:8'),
            annotations.deleteNoteById(deleted.id),
          );
          await settle();
          await settle();
        }
        return result;
      });

    await expect(
      annotations.applyAnnotationChanges({
        removeBookmarks: ['1:1'],
        addBookmarks: [
          {verseKey: '2:2', surahNumber: 2, ayahNumber: 2, rewayahId: 'warsh'},
        ],
      }),
    ).rejects.toThrow('disk I/O error');
    expect(issued).toHaveLength(7);
    await Promise.all(issued);
    jest.restoreAllMocks();

    // The change left nothing; every write issued during it was kept.
    const bookmarks = await annotations.getAllBookmarks();
    expect(bookmarks.map(b => b.verseKey).sort()).toEqual(['1:1', '4:4']);
    const notes = await annotations.getAllNotes();
    expect(
      notes
        .map(n => [n.verseKey, n.content, n.rewayahId ?? null])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toEqual([
      ['3:3', 'kept', 'warsh'],
      ['6:6', 'after', null],
    ]);
    const highlights = [
      ...(await annotations.getHighlightsBySurah(5)),
      ...(await annotations.getHighlightsBySurah(7)),
    ];
    expect(highlights.map(h => [h.verseKey, h.color])).toEqual([
      ['5:5', 'green'],
    ]);
  });
});
