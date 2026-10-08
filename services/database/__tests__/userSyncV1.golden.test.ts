jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import path from 'path';
import {
  copyGoldenInto,
  goldenManifest,
  listTables,
  primaryKey,
  readTable,
  type Row,
} from '@/test-utils/goldenDb';
import {
  openAdapterDatabase,
  type AdapterDatabase,
} from '@/test-utils/sqliteAdapter';
import {
  PERSISTED_ID_MIGRATIONS,
  isRewayahId,
} from '@/services/rewayah/RewayahIdentity';
import {
  GUEST_OWNER_SCOPE,
  USER_SYNC_V1_VERSION,
} from '../migrations/userSyncV1';
import {USER_SYNC_V2_VERSION} from '../migrations/userSyncV2';
// Do not import anything here that loads expo-sqlite (userSyncV3, the sync
// services): jest falls back to the outer registry's mock once it exists, so
// the services would open the outer mock directory instead of the golden copy.

// Golden-database upgrade tests for the QF user sync migration (userSyncV1,
// followed by the additive V2 and V3 steps that run in the same initialize).
// Each shipped release's verse-annotations.db is copied into a fresh mock
// directory and opened by #320's services exactly as AppInitializer does.

type MockModule = typeof import('@/test-utils/mockExpoSqlite');
type AnnotationDatabase =
  typeof import('../VerseAnnotationDatabase').verseAnnotationDatabase;
type Annotations =
  typeof import('../VerseAnnotationDatabaseService').verseAnnotationDatabaseService;
type SyncDatabase =
  typeof import('@/services/sync/qfSyncDatabaseService').qfSyncDatabaseService;
type GuestImport =
  typeof import('@/services/sync/qfGuestImportService').qfGuestImportService;

interface Services {
  mock: MockModule;
  v3Version: string;
  database: AnnotationDatabase;
  annotations: Annotations;
  sync: SyncDatabase;
  guestImport: GuestImport;
}

interface TableDump {
  pk: string[];
  rows: Row[];
}
type Dump = Record<string, TableDump>;

interface SchemaRow {
  type: string;
  name: string;
  sql: string | null;
}

const DB_FILE = 'verse-annotations.db';
const FIRST_LAUNCH_TAG = 'v2.2.1-first-launch';
const PRE_REWAYAH_TAG = 'v2.1.2';
const TAGS = ['v2.1.2', 'v2.2.1', FIRST_LAUNCH_TAG, 'v2.3.0'];
const LEGACY = ['shouba', 'bazzi', 'qumbul', 'qaloon', 'doori', 'soosi'];
const ANNOTATION_TABLES = ['bookmarks', 'notes', 'highlights'];
const ORPHAN = 'notes_new';
// Tables userSyncV1 to V3 create. None may hold rows for guest data: guest
// annotations reach the outbox only through an explicit signed-in merge
// (qfGuestImportService.merge), never during the migration.
const SYNC_TABLES = [
  'qf_guest_imports',
  'qf_note_conflicts',
  'qf_reading_locations',
  'qf_sync_outbox',
  'qf_sync_payload_blocks',
  'qf_sync_state',
];

// Final column order of each annotation table after userSyncV1.
const COLUMNS: Record<string, string[]> = {
  bookmarks: [
    'id',
    'owner_scope',
    'verse_key',
    'surah_number',
    'ayah_number',
    'created_at',
    'rewayah_id',
    'remote_id',
    'server_created_at',
    'server_updated_at',
  ],
  notes: [
    'id',
    'owner_scope',
    'verse_key',
    'surah_number',
    'ayah_number',
    'content',
    'verse_keys',
    'created_at',
    'updated_at',
    'rewayah_id',
    'remote_id',
    'server_created_at',
    'server_updated_at',
  ],
  highlights: [
    'id',
    'owner_scope',
    'verse_key',
    'surah_number',
    'ayah_number',
    'color',
    'created_at',
    'rewayah_id',
    'remote_id',
    'server_created_at',
    'server_updated_at',
  ],
};

// The only documented change to a pre-existing value, with the same
// expectation upgrade.golden.test.ts uses: legacy rewayah slugs are renamed
// and NULL becomes 'hafs'.
function mapRewayah(value: unknown): unknown {
  if (value === null) return 'hafs';
  if (typeof value !== 'string') return value;
  return PERSISTED_ID_MIGRATIONS[value] ?? value;
}

// Values every pre-existing row must get in a column it did not have.
// v2.1.2 predates rewayah_id, so it is backfilled to 'hafs' there.
const ADDED: Record<string, unknown> = {
  owner_scope: GUEST_OWNER_SCOPE,
  rewayah_id: 'hafs',
  remote_id: null,
  server_created_at: null,
  server_updated_at: null,
};

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
    // Copy into this registry's mock directory, never the committed file:
    // goldens are committed without WAL sidecars and must stay pristine.
    if (copyTag) copyGoldenInto(copyTag, mock.databaseDir());
    result = {
      mock,
      v3Version: require('../migrations/userSyncV3').USER_SYNC_V3_VERSION,
      database: require('../VerseAnnotationDatabase').verseAnnotationDatabase,
      annotations: require('../VerseAnnotationDatabaseService')
        .verseAnnotationDatabaseService,
      sync: require('@/services/sync/qfSyncDatabaseService')
        .qfSyncDatabaseService,
      guestImport: require('@/services/sync/qfGuestImportService')
        .qfGuestImportService,
    };
  });
  if (shared) {
    jest.doMock(
      'expo-sqlite',
      () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
    );
  }
  if (!result) throw new Error('services not loaded');
  return result;
}

describe.each(TAGS)('userSyncV1 fork columns on %s', tag => {
  it('keeps Qariah-style identities through initialize and reopen with no queued uploads', async () => {
    let s = loadServices(tag);
    try {
      const legacy = openAdapterDatabase(
        path.join(s.mock.databaseDir(), DB_FILE),
      );
      let before: Dump;
      try {
        for (const table of ANNOTATION_TABLES) {
          await legacy.execAsync(`
            ALTER TABLE ${table} ADD COLUMN qf_note_id TEXT;
            ALTER TABLE ${table} ADD COLUMN qf_post_id TEXT;
            UPDATE ${table} SET qf_note_id = 'fork-note-' || id,
              qf_post_id = 'fork-post-' || id;
          `);
        }
        await legacy.execAsync(`UPDATE notes SET qf_post_id = NULL
          WHERE id = (SELECT id FROM notes ORDER BY id LIMIT 1);`);
        before = await dumpDb(legacy);
      } finally {
        await legacy.closeAsync();
      }

      await initAll(s);
      const migrated = await dumpDb(await s.mock.openDatabaseAsync(DB_FILE));
      for (const table of ANNOTATION_TABLES) {
        const expected = before[table].rows.map(row => {
          const {qf_note_id, qf_post_id, ...bayaanColumns} = row;
          return {...expectedRow(table, bayaanColumns), qf_note_id, qf_post_id};
        });
        expect(migrated[table].rows).toEqual(expected);
      }
      for (const table of SYNC_TABLES) expect(migrated[table].rows).toEqual([]);
      await s.database.close();
      s = loadServices(null, s.mock);
      await initAll(s);
      expect(await dumpDb(await s.mock.openDatabaseAsync(DB_FILE))).toEqual(
        migrated,
      );
    } finally {
      await s.database.close();
      await s.mock.resetDatabases();
    }
  });
});

// What AppInitializer runs for this database on launch.
async function initAll(s: Services): Promise<void> {
  await s.annotations.initialize();
  await s.sync.initialize();
}

async function dumpDb(db: AdapterDatabase): Promise<Dump> {
  const dump: Dump = {};
  for (const name of await listTables(db)) {
    dump[name] = {
      pk: await primaryKey(db, name),
      rows: await readTable(db, name),
    };
  }
  return dump;
}

async function schemaOf(db: AdapterDatabase): Promise<SchemaRow[]> {
  return db.getAllAsync<SchemaRow>(
    "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
  );
}

// Reads the golden copy straight from disk, before any #320 code runs.
async function dumpBefore(dir: string): Promise<Dump> {
  const db = openAdapterDatabase(path.join(dir, DB_FILE));
  try {
    return await dumpDb(db);
  } finally {
    await db.closeAsync();
  }
}

function pkOf(row: Row, pk: string[]): string {
  return JSON.stringify(pk.map(c => row[c]));
}

function expectedRow(table: string, before: Row): Row {
  const expected: Row = {};
  // A legacy column the rebuilt table does not carry would be data loss.
  for (const column of Object.keys(before)) {
    if (!COLUMNS[table].includes(column)) {
      throw new Error(`${table}.${column}: dropped by the rebuild`);
    }
  }
  for (const column of COLUMNS[table]) {
    if (column in before) {
      expected[column] =
        column === 'rewayah_id' ? mapRewayah(before[column]) : before[column];
      continue;
    }
    if (!(column in ADDED)) {
      throw new Error(`${table}.${column}: no documented default`);
    }
    expected[column] = ADDED[column];
  }
  return expected;
}

function rewayahValues(dump: Dump, table: string): unknown[] {
  return (dump[table]?.rows ?? []).map(r => r.rewayah_id);
}

describe.each(TAGS)('userSyncV1 on %s verse-annotations.db', tag => {
  let s: Services;
  let before: Dump;
  let after: Dump;
  const accountId = 'golden-account';

  beforeAll(async () => {
    s = loadServices(tag);
    before = await dumpBefore(s.mock.databaseDir());
    await initAll(s);
    after = await dumpDb(await s.mock.openDatabaseAsync(DB_FILE));
  });

  afterAll(async () => {
    await s.database.close();
    await s.mock.resetDatabases();
  });

  it('sanity: the golden is a pre-sync database matching its manifest', () => {
    const manifest = goldenManifest(tag);
    for (const table of ANNOTATION_TABLES) {
      expect({table, rows: before[table]?.rows.length}).toEqual({
        table,
        rows: manifest.tables[`verse-annotations/${table}`],
      });
      expect(before[table].pk).toEqual(['id']);
    }
    expect(before.bookmarks.rows).toHaveLength(15);
    expect(before.schema_migrations).toBeUndefined();
    for (const table of SYNC_TABLES) expect(before[table]).toBeUndefined();
    const ownerScope = before.bookmarks.rows.some(r => 'owner_scope' in r);
    expect(ownerScope).toBe(false);
  });

  it('records the user sync migrations', () => {
    expect(after.schema_migrations?.rows.map(r => r.version)).toEqual(
      [USER_SYNC_V1_VERSION, USER_SYNC_V2_VERSION, s.v3Version].sort(),
    );
  });

  it('keeps every bookmark, note and highlight row by primary key', () => {
    for (const table of ANNOTATION_TABLES) {
      const pre = before[table];
      const post = after[table];
      expect(post.pk).toEqual(['id']);
      expect({table, rows: post.rows.length}).toEqual({
        table,
        rows: pre.rows.length,
      });
      const postById = new Map(post.rows.map(r => [pkOf(r, post.pk), r]));
      for (const row of pre.rows) {
        const id = pkOf(row, pre.pk);
        expect({table, id, row: postById.get(id)}).toEqual({
          table,
          id,
          row: expectedRow(table, row),
        });
      }
    }
  });

  it('gives each annotation table exactly the documented columns', () => {
    for (const table of ANNOTATION_TABLES) {
      for (const row of after[table].rows) {
        expect({table, columns: Object.keys(row)}).toEqual({
          table,
          columns: COLUMNS[table],
        });
      }
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
    if (tag === PRE_REWAYAH_TAG) {
      for (const table of ANNOTATION_TABLES) {
        expect(before[table].rows.some(r => 'rewayah_id' in r)).toBe(false);
        expect(new Set(rewayahValues(after, table))).toEqual(new Set(['hafs']));
      }
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

  it('marks upgraded data as guest-owned with no server identity', async () => {
    for (const table of ANNOTATION_TABLES) {
      for (const row of after[table].rows) {
        expect({
          table,
          id: row.id,
          owner_scope: row.owner_scope,
          remote_id: row.remote_id,
          server_created_at: row.server_created_at,
          server_updated_at: row.server_updated_at,
        }).toEqual({
          table,
          id: row.id,
          owner_scope: GUEST_OWNER_SCOPE,
          remote_id: null,
          server_created_at: null,
          server_updated_at: null,
        });
      }
    }
    const bookmarks = await s.annotations.getAllBookmarks();
    const notes = await s.annotations.getAllNotes();
    const highlights = await s.annotations.getHighlightsBySurah(1);
    expect(bookmarks).toHaveLength(before.bookmarks.rows.length);
    expect(notes).toHaveLength(before.notes.rows.length);
    expect(highlights).toHaveLength(before.highlights.rows.length);
    for (const a of [...bookmarks, ...notes, ...highlights]) {
      expect(a.ownerScope).toBe(GUEST_OWNER_SCOPE);
      expect(a.remoteId).toBeUndefined();
      expect(isRewayahId(a.rewayahId)).toBe(true);
    }
  });

  it('creates the sync tables empty: nothing is enqueued for guest data', async () => {
    for (const table of SYNC_TABLES) {
      expect({table, rows: after[table]?.rows}).toEqual({table, rows: []});
    }
    expect(await s.sync.getOutboxEntries(accountId)).toEqual([]);
    // The upgraded rows are offered for import on sign-in, nothing more.
    const manifest = goldenManifest(tag);
    const bookmarkCount = manifest.tables['verse-annotations/bookmarks'];
    const noteCount = manifest.tables['verse-annotations/notes'];
    const highlightCount = manifest.tables['verse-annotations/highlights'];
    expect(await s.guestImport.getOffer(accountId)).toEqual({
      bookmarkCount,
      noteCount,
      highlightCount,
      totalCount: bookmarkCount + noteCount + highlightCount,
    });
    expect(await s.guestImport.getDecision(accountId)).toBeNull();
  });

  it('is not broken by the real-device notes_new orphan', () => {
    // Real devices carry an empty orphan notes_new table from the old "drop
    // UNIQUE" migration. The legacy notes cleanup drops it before userSyncV1,
    // which must still rebuild notes without losing rows.
    const orphan = before[ORPHAN];
    if (tag === FIRST_LAUNCH_TAG) {
      expect(orphan).toBeUndefined();
    } else {
      expect(orphan?.rows).toEqual([]);
    }
    expect(after[ORPHAN]).toBeUndefined();
    expect(after.notes.rows).toHaveLength(before.notes.rows.length);
    expect(after.schema_migrations.rows.map(r => r.version)).toContain(
      USER_SYNC_V1_VERSION,
    );
  });

  it('is idempotent: a second initialize changes nothing', async () => {
    const db = await s.mock.openDatabaseAsync(DB_FILE);
    const first = await dumpDb(db);
    const firstSchema = await schemaOf(db);
    expect(first).toEqual(after);
    // Guard against a vacuous run on an unmigrated copy.
    expect(first.schema_migrations?.rows).toHaveLength(3);
    await s.database.close();

    const second = loadServices(null, s.mock);
    await initAll(second);
    const reopened = await second.mock.openDatabaseAsync(DB_FILE);
    expect(await dumpDb(reopened)).toEqual(first);
    expect(await schemaOf(reopened)).toEqual(firstSchema);
    expect(await second.sync.getOutboxEntries(accountId)).toEqual([]);
    s = second;
  });
});
