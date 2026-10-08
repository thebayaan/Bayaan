jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import path from 'path';
import {openAdapterDatabase} from '@/test-utils/sqliteAdapter';
import {readTable, type Row} from '@/test-utils/goldenDb';
import {hasVerseKeyUniqueConstraint} from '../migrations/legacyNotesCleanup';

type MockModule = typeof import('@/test-utils/mockExpoSqlite');
type Annotations =
  typeof import('../VerseAnnotationDatabaseService').verseAnnotationDatabaseService;

interface Loaded {
  mock: MockModule;
  annotations: Annotations;
}

interface IndexListRow {
  name: string;
  unique: number;
  origin: string;
}

const DB_FILE = 'verse-annotations.db';

// The oldest notes schema: one note per verse, enforced by UNIQUE(verse_key).
const OLD_NOTES = `
  CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    verse_key TEXT NOT NULL UNIQUE,
    surah_number INTEGER NOT NULL,
    ayah_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;

const CURRENT_NOTES = `
  CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    verse_key TEXT NOT NULL,
    surah_number INTEGER NOT NULL,
    ayah_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    verse_keys TEXT,
    rewayah_id TEXT
  );
`;

// The orphan exactly as the old migration left it on devices.
const ORPHAN_NOTES_NEW = `
  CREATE TABLE notes_new (
    id TEXT PRIMARY KEY,
    verse_key TEXT NOT NULL,
    surah_number INTEGER NOT NULL,
    ayah_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;

function load(): Loaded {
  return {
    mock: require('@/test-utils/mockExpoSqlite'),
    annotations: require('../VerseAnnotationDatabaseService')
      .verseAnnotationDatabaseService,
  };
}

// Writes a database file before any service code opens it.
async function seed(mock: MockModule, sql: string): Promise<void> {
  const db = openAdapterDatabase(path.join(mock.databaseDir(), DB_FILE));
  await db.execAsync(sql);
  await db.closeAsync();
}

async function rawNotes(mock: MockModule, table = 'notes'): Promise<Row[]> {
  const db = await mock.openDatabaseAsync(DB_FILE);
  return readTable(db, table);
}

async function tableNames(mock: MockModule): Promise<string[]> {
  const db = await mock.openDatabaseAsync(DB_FILE);
  const rows = await db.getAllAsync<{name: string}>(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  );
  return rows.map(r => r.name);
}

async function notesIndexes(mock: MockModule): Promise<IndexListRow[]> {
  const db = await mock.openDatabaseAsync(DB_FILE);
  return db.getAllAsync<IndexListRow>(
    'SELECT name, "unique", origin FROM pragma_index_list(\'notes\')',
  );
}

// Columns userSyncV1 adds when it rebuilds notes into the owner-scoped schema.
function synced(row: Row): Row {
  return {
    ...row,
    owner_scope: 'guest',
    remote_id: null,
    server_created_at: null,
    server_updated_at: null,
  };
}

function oldRow(i: number): string {
  return `('note-${i}', '1:${i}', 1, ${i}, 'body ${i}', ${1000 + i}, ${
    2000 + i
  })`;
}

describe('notes table migrations', () => {
  let loaded: Loaded;

  beforeEach(() => {
    jest.resetModules();
    loaded = load();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await loaded.annotations.close();
    await loaded.mock.resetDatabases();
  });

  it('removes the old UNIQUE(verse_key) constraint and keeps every row', async () => {
    const {mock, annotations} = loaded;
    await seed(
      mock,
      `${OLD_NOTES} INSERT INTO notes VALUES ${[1, 2, 3]
        .map(oldRow)
        .join(', ')};`,
    );
    const before = await rawNotes(mock);
    expect(before).toHaveLength(3);
    expect((await notesIndexes(mock)).some(i => i.origin === 'u')).toBe(true);
    await mock.closeOpenDatabases();

    await annotations.initialize();

    expect((await notesIndexes(mock)).some(i => i.origin === 'u')).toBe(false);
    expect(await rawNotes(mock)).toEqual(
      before.map(r => synced({...r, verse_keys: null, rewayah_id: 'hafs'})),
    );
    expect(await tableNames(mock)).not.toContain('notes_new');
    expect(await tableNames(mock)).not.toContain('notes_rebuild');

    // A second note on the same verse is now allowed.
    await annotations.addNote('1:1', 1, 1, 'second note', undefined, 'hafs');
    expect(await annotations.getNotesForVerse('1:1')).toHaveLength(2);
  });

  it('keeps verse_keys and rewayah_id when rebuilding a UNIQUE notes table', async () => {
    const {mock, annotations} = loaded;
    await seed(
      mock,
      `${OLD_NOTES}
       ALTER TABLE notes ADD COLUMN verse_keys TEXT;
       ALTER TABLE notes ADD COLUMN rewayah_id TEXT;
       INSERT INTO notes VALUES
         ('a', '2:1', 2, 1, 'multi', 10, 20, '2:1,2:2', 'warsh'),
         ('b', '2:5', 2, 5, 'plain', 11, 21, NULL, 'hafs');`,
    );

    await annotations.initialize();

    expect((await notesIndexes(mock)).some(i => i.origin === 'u')).toBe(false);
    expect(await rawNotes(mock)).toEqual([
      synced({
        id: 'a',
        verse_key: '2:1',
        surah_number: 2,
        ayah_number: 1,
        content: 'multi',
        created_at: 10,
        updated_at: 20,
        verse_keys: '2:1,2:2',
        rewayah_id: 'warsh',
      }),
      synced({
        id: 'b',
        verse_key: '2:5',
        surah_number: 2,
        ayah_number: 5,
        content: 'plain',
        created_at: 11,
        updated_at: 21,
        verse_keys: null,
        rewayah_id: 'hafs',
      }),
    ]);
  });

  it('does not rebuild a notes table whose only autoindex is the primary key', async () => {
    const {mock, annotations} = loaded;
    await seed(
      mock,
      `${CURRENT_NOTES}
       INSERT INTO notes VALUES ('n', '3:1', 3, 1, 'kept', 1, 2, NULL, 'hafs');`,
    );
    const indexes = await notesIndexes(mock);
    expect(indexes.map(i => i.origin)).toEqual(['pk']);

    // userSyncV1 rebuilds notes once into the owner-scoped schema; no later
    // launch may rebuild it again.
    await annotations.initialize();
    await annotations.close();
    await mock.closeOpenDatabases();
    const db = await mock.openDatabaseAsync(DB_FILE);
    const master = await db.getFirstAsync<{rootpage: number}>(
      "SELECT rootpage FROM sqlite_master WHERE name='notes'",
    );
    await mock.closeOpenDatabases();

    // Relaunch: the closed service reopens the same database file.
    await annotations.initialize();

    const reopened = await mock.openDatabaseAsync(DB_FILE);
    const after = await reopened.getFirstAsync<{rootpage: number}>(
      "SELECT rootpage FROM sqlite_master WHERE name='notes'",
    );
    expect(after?.rootpage).toBe(master?.rootpage);
    expect((await rawNotes(mock)).map(r => r.id)).toEqual(['n']);
    expect(await tableNames(mock)).not.toContain('notes_new');
  });

  it('treats only a single-column UNIQUE(verse_key) as the legacy constraint', async () => {
    const {mock} = loaded;
    const cases: [string, boolean][] = [
      ['verse_key TEXT NOT NULL UNIQUE, owner_scope TEXT', true],
      ['verse_key TEXT, owner_scope TEXT, UNIQUE(verse_key)', true],
      [
        'verse_key TEXT, owner_scope TEXT, UNIQUE(owner_scope, verse_key)',
        false,
      ],
      [
        'verse_key TEXT, owner_scope TEXT, UNIQUE(verse_key, owner_scope)',
        false,
      ],
    ];
    for (const [columns, expected] of cases) {
      const db = await mock.openDatabaseAsync(DB_FILE);
      await db.execAsync(
        `DROP TABLE IF EXISTS notes; CREATE TABLE notes (id TEXT PRIMARY KEY, ${columns});`,
      );
      expect(await hasVerseKeyUniqueConstraint(db)).toBe(expected);
    }
  });

  it('does not rebuild an owner-scoped notes table with a composite UNIQUE on a later launch', async () => {
    const {mock, annotations} = loaded;
    // A fork-owned column with a composite UNIQUE that includes verse_key.
    // userSyncV1 keeps the constraint (origin 'u') because it names a column
    // Bayaan does not own.
    await seed(
      mock,
      `${CURRENT_NOTES}
       ALTER TABLE notes RENAME TO notes_seed;
       CREATE TABLE notes (
         id TEXT PRIMARY KEY,
         verse_key TEXT NOT NULL,
         surah_number INTEGER NOT NULL,
         ayah_number INTEGER NOT NULL,
         content TEXT NOT NULL,
         created_at INTEGER NOT NULL,
         updated_at INTEGER NOT NULL,
         verse_keys TEXT,
         rewayah_id TEXT,
         fork_tag TEXT NOT NULL DEFAULT 'x',
         UNIQUE(verse_key, fork_tag)
       );
       DROP TABLE notes_seed;
       INSERT INTO notes VALUES ('n', '3:1', 3, 1, 'kept', 1, 2, NULL, 'hafs', 'x');`,
    );

    await annotations.initialize();
    await annotations.close();
    await mock.closeOpenDatabases();
    const db = await mock.openDatabaseAsync(DB_FILE);
    const migrated = await db.getFirstAsync<{rootpage: number; sql: string}>(
      "SELECT rootpage, sql FROM sqlite_master WHERE name='notes'",
    );
    expect(migrated?.sql).toMatch(/owner_scope TEXT NOT NULL DEFAULT 'guest'/);
    expect((await notesIndexes(mock)).some(i => i.origin === 'u')).toBe(true);
    await mock.closeOpenDatabases();

    // Relaunch: the legacy cleanup must not rebuild notes into the old schema.
    await annotations.initialize();

    const reopened = await mock.openDatabaseAsync(DB_FILE);
    const after = await reopened.getFirstAsync<{rootpage: number; sql: string}>(
      "SELECT rootpage, sql FROM sqlite_master WHERE name='notes'",
    );
    expect(after).toEqual(migrated);
    expect(await rawNotes(mock)).toEqual([
      synced({
        id: 'n',
        verse_key: '3:1',
        surah_number: 3,
        ayah_number: 1,
        content: 'kept',
        verse_keys: null,
        created_at: 1,
        updated_at: 2,
        rewayah_id: 'hafs',
        fork_tag: 'x',
      }),
    ]);
  });

  it('drops an empty orphan notes_new table', async () => {
    const {mock, annotations} = loaded;
    await seed(mock, `${CURRENT_NOTES} ${ORPHAN_NOTES_NEW}`);

    await annotations.initialize();

    expect(await tableNames(mock)).not.toContain('notes_new');
  });

  it('leaves a non-empty notes_new untouched and warns', async () => {
    const {mock, annotations} = loaded;
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    await seed(
      mock,
      `${CURRENT_NOTES} ${ORPHAN_NOTES_NEW}
       INSERT INTO notes VALUES ('n', '3:1', 3, 1, 'live', 1, 2, NULL, 'hafs');
       INSERT INTO notes_new VALUES ('x', '4:1', 4, 1, 'stray', 5, 6);`,
    );

    await annotations.initialize();

    expect(await tableNames(mock)).toContain('notes_new');
    expect(await rawNotes(mock, 'notes_new')).toEqual([
      {
        id: 'x',
        verse_key: '4:1',
        surah_number: 4,
        ayah_number: 1,
        content: 'stray',
        created_at: 5,
        updated_at: 6,
      },
    ]);
    expect((await annotations.getAllNotes()).map(n => n.id)).toEqual(['n']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('notes_new'));
  });
});
