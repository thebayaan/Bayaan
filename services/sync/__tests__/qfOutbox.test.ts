const sqlitePromise = (async () => {
  const fs = require('fs');
  const path = require('path');
  const {TextDecoder} = require('util');
  global.TextDecoder = TextDecoder;
  const waSqliteDir = path.join(
    process.cwd(),
    'node_modules',
    'expo-sqlite',
    'web',
    'wa-sqlite',
  );
  const ModuleFactory = require(path.join(waSqliteDir, 'wa-sqlite.js'));
  const SQLite = require(path.join(waSqliteDir, 'sqlite-api.js'));
  const wasmBinary = fs.readFileSync(path.join(waSqliteDir, 'wa-sqlite.wasm'));
  const module = await ModuleFactory({wasmBinary});
  return {sqlite3: SQLite.Factory(module), SQLite};
})();

type TestDatabase = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: unknown[] | Record<string, unknown>): Promise<unknown>;
  getAllAsync<T extends Record<string, unknown>>(
    source: string,
    params?: unknown[] | Record<string, unknown>,
  ): Promise<T[]>;
  getFirstAsync<T extends Record<string, unknown>>(
    source: string,
    params?: unknown[] | Record<string, unknown>,
  ): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
};

class ExpoSqliteWasmDatabase implements TestDatabase {
  private readonly dbPromise: Promise<number>;

  constructor(databaseName: string) {
    this.dbPromise = sqlitePromise.then(({sqlite3}) =>
      sqlite3.open_v2(databaseName),
    );
  }

  async execAsync(source: string): Promise<void> {
    const {sqlite3} = await sqlitePromise;
    const db = await this.dbPromise;
    await sqlite3.exec(db, source);
  }

  async runAsync(
    source: string,
    params: unknown[] | Record<string, unknown> = [],
  ): Promise<unknown> {
    const {sqlite3} = await sqlitePromise;
    const db = await this.dbPromise;

    for await (const stmt of sqlite3.statements(db, source)) {
      sqlite3.bind_collection(stmt, params);
      await sqlite3.step(stmt);
    }

    return {
      changes: sqlite3.changes(db),
      lastInsertRowId: sqlite3.last_insert_rowid(db),
    };
  }

  async getAllAsync<T extends Record<string, unknown>>(
    source: string,
    params: unknown[] | Record<string, unknown> = [],
  ): Promise<T[]> {
    const {sqlite3, SQLite} = await sqlitePromise;
    const db = await this.dbPromise;
    const rows: T[] = [];

    for await (const stmt of sqlite3.statements(db, source)) {
      sqlite3.bind_collection(stmt, params);
      const names = sqlite3.column_names(stmt);

      while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
        const values = sqlite3.row(stmt);
        rows.push(
          Object.fromEntries(
            names.map((name: string, index: number) => [name, values[index]]),
          ) as T,
        );
      }
    }

    return rows;
  }

  async getFirstAsync<T extends Record<string, unknown>>(
    source: string,
    params: unknown[] | Record<string, unknown> = [],
  ): Promise<T | null> {
    const rows = await this.getAllAsync<T>(source, params);
    return rows[0] ?? null;
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    await this.execAsync('BEGIN');
    try {
      await task();
      await this.execAsync('COMMIT');
    } catch (error) {
      await this.execAsync('ROLLBACK');
      throw error;
    }
  }

  async closeAsync(): Promise<void> {
    const {sqlite3} = await sqlitePromise;
    const db = await this.dbPromise;
    await sqlite3.close(db);
  }
}

const mockOpenDatabaseAsync = jest.fn(async (databaseName: string) => {
  return new ExpoSqliteWasmDatabase(databaseName);
});

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: mockOpenDatabaseAsync,
}));

const testRunDatabasePrefix = `qf-outbox-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2)}`;

async function createServices(name: string) {
  jest.resetModules();
  jest.doMock('expo-sqlite', () => ({
    openDatabaseAsync: mockOpenDatabaseAsync,
  }));
  const {VerseAnnotationDatabase} = require(
    '@/services/database/VerseAnnotationDatabase'
  );
  const {VerseAnnotationDatabaseService} = require(
    '@/services/database/VerseAnnotationDatabaseService'
  );
  const {QfSyncDatabaseService} = require(
    '@/services/sync/qfSyncDatabaseService'
  );
  const database = new VerseAnnotationDatabase(
    `${testRunDatabasePrefix}-${name}`,
  );
  const annotations = new VerseAnnotationDatabaseService(database);
  const sync = new QfSyncDatabaseService({
    database,
    annotations,
  });

  return {database, annotations, sync};
}

describe('QfSyncDatabaseService atomic outbox writes', () => {
  it('rolls back the local bookmark when enqueue fails inside the same SQLite transaction', async () => {
    const {database, annotations, sync} = await createServices(
      'qf-outbox-atomic-bookmark.db',
    );
    await sync.initialize();

    const connection = (await database.getConnection()) as TestDatabase;
    const originalRunAsync = connection.runAsync.bind(connection);
    let injected = false;
    connection.runAsync = async (source, params) => {
      if (!injected && source.includes('INSERT INTO qf_sync_outbox')) {
        injected = true;
        throw new Error('inject enqueue failure');
      }

      return originalRunAsync(source, params);
    };

    await expect(
      sync.addBookmark({
        accountId: 'reader-a',
        verseKey: '2:255',
        surahNumber: 2,
        ayahNumber: 255,
        rewayahId: 'warsh',
      }),
    ).rejects.toThrow('inject enqueue failure');

    await expect(
      annotations.getAllBookmarksInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([]);
    await expect(
      connection.getFirstAsync<{count: number}>(
        `SELECT COUNT(*) AS count FROM qf_sync_outbox WHERE owner_scope = ?`,
        ['qf:reader-a'],
      ),
    ).resolves.toEqual({count: 0});

    await database.close();
  });

  it('updates bookmark remote metadata and removes the outbox row in one acknowledgement transaction', async () => {
    const {database, annotations, sync} = await createServices(
      'qf-outbox-ack.db',
    );
    await sync.initialize();

    const bookmark = await sync.addBookmark({
      accountId: 'reader-a',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      rewayahId: 'warsh',
    });
    const [operation] = await sync.getOutboxEntries('reader-a');

    expect(operation).toMatchObject({
      resource: 'BOOKMARK',
      mutationType: 'CREATE',
      localId: bookmark.id,
    });

    await sync.acknowledgeOperation({
      accountId: 'reader-a',
      localOperationId: operation.localOperationId,
      resourceId: 'remote-bookmark-1',
      serverCreatedAt: 1701,
      serverUpdatedAt: 1801,
    });

    await expect(
      annotations.getAllBookmarksInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: bookmark.id,
        remoteId: 'remote-bookmark-1',
        serverCreatedAt: 1701,
        serverUpdatedAt: 1801,
      }),
    ]);
    await expect(sync.getOutboxEntries('reader-a')).resolves.toEqual([]);

    await database.close();
  });

  it('rolls back acknowledgement metadata when outbox removal fails in the same SQLite transaction', async () => {
    const {database, annotations, sync} = await createServices(
      'qf-outbox-ack-rollback.db',
    );
    await sync.initialize();

    const bookmark = await sync.addBookmark({
      accountId: 'reader-a',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      rewayahId: 'warsh',
    });
    const [operation] = await sync.getOutboxEntries('reader-a');

    const connection = (await database.getConnection()) as TestDatabase;
    const originalRunAsync = connection.runAsync.bind(connection);
    let injected = false;
    connection.runAsync = async (source, params) => {
      if (
        !injected &&
        source.includes('DELETE FROM qf_sync_outbox') &&
        Array.isArray(params) &&
        params[1] === operation.localOperationId
      ) {
        injected = true;
        throw new Error('inject acknowledgement delete failure');
      }

      return originalRunAsync(source, params);
    };

    await expect(
      sync.acknowledgeOperation({
        accountId: 'reader-a',
        localOperationId: operation.localOperationId,
        resourceId: 'remote-bookmark-1',
        serverCreatedAt: 1701,
        serverUpdatedAt: 1801,
      }),
    ).rejects.toThrow('inject acknowledgement delete failure');

    await expect(
      annotations.getAllBookmarksInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: bookmark.id,
        remoteId: undefined,
        serverCreatedAt: undefined,
        serverUpdatedAt: undefined,
      }),
    ]);
    await expect(sync.getOutboxEntries('reader-a')).resolves.toEqual([
      expect.objectContaining({
        localOperationId: operation.localOperationId,
      }),
    ]);

    await database.close();
  });

  it('defaults omitted rewayah to hafs for bookmark, note, and reading-location writes', async () => {
    const {database, annotations, sync} = await createServices(
      'qf-default-rewayah.db',
    );
    await sync.initialize();

    const bookmark = await sync.addBookmark({
      accountId: 'reader-a',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
    });
    const note = await sync.addNote({
      accountId: 'reader-a',
      verseKey: '18:10',
      surahNumber: 18,
      ayahNumber: 10,
      content: 'No rewayah note',
    });
    await sync.upsertReadingLocation({
      accountId: 'reader-a',
      verseKey: '3:7',
      surahNumber: 3,
      ayahNumber: 7,
      lastReadAt: 5001,
    });

    expect(bookmark.rewayahId).toBe('hafs');
    expect(note.rewayahId).toBe('hafs');
    await expect(
      annotations.getAllBookmarksInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({
        rewayahId: 'hafs',
      }),
    ]);
    await expect(
      annotations.getAllNotesInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({
        rewayahId: 'hafs',
      }),
    ]);
    await expect(sync.getReadingLocations('reader-a')).resolves.toEqual([
      expect.objectContaining({
        rewayahId: 'hafs',
      }),
    ]);

    await database.close();
  });

  it('preserves the final bookmark intent across restart without leaking outbox rows between accounts', async () => {
    const databaseName = 'qf-outbox-restart.db';
    let services = await createServices(databaseName);
    await services.sync.initialize();

    await services.sync.addBookmark({
      accountId: 'reader-a',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      rewayahId: 'warsh',
    });
    await services.sync.removeBookmark({
      accountId: 'reader-a',
      verseKey: '2:255',
    });
    await services.sync.addBookmark({
      accountId: 'reader-a',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      rewayahId: 'warsh',
    });
    await services.sync.addBookmark({
      accountId: 'reader-b',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      rewayahId: 'hafs',
    });

    await services.database.close();
    services = await createServices(databaseName);
    await services.sync.initialize();

    await expect(
      services.annotations.isBookmarkedInOwnerScope('qf:reader-a', '2:255'),
    ).resolves.toBe(true);
    await expect(
      services.annotations.isBookmarkedInOwnerScope('qf:reader-b', '2:255'),
    ).resolves.toBe(true);

    await expect(services.sync.getOutboxEntries('reader-a')).resolves.toEqual([
      expect.objectContaining({
        resource: 'BOOKMARK',
        mutationType: 'CREATE',
        ownerScope: 'qf:reader-a',
      }),
    ]);
    await expect(services.sync.getOutboxEntries('reader-b')).resolves.toEqual([
      expect.objectContaining({
        resource: 'BOOKMARK',
        mutationType: 'CREATE',
        ownerScope: 'qf:reader-b',
      }),
    ]);

    await services.database.close();
  });

  it('coalesces reading sessions to the latest resume location while keeping page and rewayah local', async () => {
    const {database, sync} = await createServices('qf-reading-locations.db');
    await sync.initialize();

    await sync.upsertReadingLocation({
      accountId: 'reader-a',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      pageNumber: 42,
      rewayahId: 'warsh',
      lastReadAt: 5001,
    });
    await sync.upsertReadingLocation({
      accountId: 'reader-a',
      verseKey: '3:7',
      surahNumber: 3,
      ayahNumber: 7,
      pageNumber: 88,
      rewayahId: 'hafs',
      lastReadAt: 5002,
    });

    await expect(sync.getReadingLocations('reader-a')).resolves.toEqual([
      expect.objectContaining({
        ownerScope: 'qf:reader-a',
        verseKey: '3:7',
        surahNumber: 3,
        ayahNumber: 7,
        pageNumber: 88,
        rewayahId: 'hafs',
        lastReadAt: 5002,
      }),
    ]);

    await expect(sync.getOutboxEntries('reader-a')).resolves.toEqual([
      expect.objectContaining({
        resource: 'READING_SESSION',
        mutationType: 'CREATE',
      }),
    ]);
    expect(
      JSON.parse((await sync.getOutboxEntries('reader-a'))[0].payloadJson),
    ).toEqual(
      expect.objectContaining({
        verseKey: '3:7',
        pageNumber: 88,
        rewayahId: 'hafs',
      }),
    );

    await database.close();
  });

  it('ignores older reading-session events transactionally across restart', async () => {
    const databaseName = 'qf-reading-location-reversed.db';
    let services = await createServices(databaseName);
    await services.sync.initialize();

    await services.sync.upsertReadingLocation({
      accountId: 'reader-a',
      verseKey: '3:7',
      surahNumber: 3,
      ayahNumber: 7,
      pageNumber: 88,
      rewayahId: 'hafs',
      lastReadAt: 5002,
    });
    const [newestOperation] = await services.sync.getOutboxEntries('reader-a');

    await services.sync.upsertReadingLocation({
      accountId: 'reader-a',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      pageNumber: 42,
      rewayahId: 'warsh',
      lastReadAt: 5001,
    });

    await services.database.close();
    services = await createServices(databaseName);
    await services.sync.initialize();

    await expect(services.sync.getReadingLocations('reader-a')).resolves.toEqual([
      expect.objectContaining({
        verseKey: '3:7',
        surahNumber: 3,
        ayahNumber: 7,
        pageNumber: 88,
        rewayahId: 'hafs',
        lastReadAt: 5002,
      }),
    ]);
    await expect(services.sync.getOutboxEntries('reader-a')).resolves.toEqual([
      expect.objectContaining({
        localOperationId: newestOperation.localOperationId,
        resource: 'READING_SESSION',
      }),
    ]);

    await services.database.close();
  });

  it('retains a newer local note edit when acknowledging an earlier in-flight create revision', async () => {
    const databaseName = 'qf-note-create-ack-race.db';
    let services = await createServices(databaseName);
    await services.sync.initialize();

    const note = await services.sync.addNote({
      accountId: 'reader-a',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      content: 'sent v1',
      verseKeys: ['2:255'],
      rewayahId: 'warsh',
    });
    const [sentCreate] = await services.sync.getOutboxEntries('reader-a');

    await services.sync.updateNote({
      accountId: 'reader-a',
      noteId: note.id,
      content: 'local v2 while create is in flight',
    });

    await services.sync.acknowledgeOperation({
      accountId: 'reader-a',
      localOperationId: sentCreate.localOperationId,
      resourceId: 'remote-note-1',
      serverCreatedAt: 6001,
      serverUpdatedAt: 6001,
      acknowledgedPayloadJson: sentCreate.payloadJson,
    });

    await services.database.close();
    services = await createServices(databaseName);
    await services.sync.initialize();

    await expect(
      services.annotations.getAllNotesInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: note.id,
        content: 'local v2 while create is in flight',
        remoteId: 'remote-note-1',
        serverCreatedAt: 6001,
        serverUpdatedAt: 6001,
      }),
    ]);

    const entries = await services.sync.getOutboxEntries('reader-a');
    expect(entries).toEqual([
      expect.objectContaining({
        resource: 'NOTE',
        mutationType: 'UPDATE',
        remoteId: 'remote-note-1',
        baseServerUpdatedAt: 6001,
      }),
    ]);
    expect(JSON.parse(entries[0].payloadJson)).toEqual(
      expect.objectContaining({
        content: 'local v2 while create is in flight',
      }),
    );

    await services.database.close();
  });

  it('deletes notes and durably enqueues only required delete intent per account', async () => {
    const databaseName = 'qf-note-delete.db';
    let services = await createServices(databaseName);
    await services.sync.initialize();

    const remoteBacked = await services.sync.addNote({
      accountId: 'reader-a',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      content: 'remote backed note',
      rewayahId: 'warsh',
    });
    const [createOperation] = await services.sync.getOutboxEntries('reader-a');
    await services.sync.acknowledgeOperation({
      accountId: 'reader-a',
      localOperationId: createOperation.localOperationId,
      resourceId: 'remote-note-1',
      serverCreatedAt: 6001,
      serverUpdatedAt: 6001,
    });

    const unsent = await services.sync.addNote({
      accountId: 'reader-a',
      verseKey: '18:10',
      surahNumber: 18,
      ayahNumber: 10,
      content: 'unsent create',
    });
    const otherAccount = await services.sync.addNote({
      accountId: 'reader-b',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      content: 'reader b note',
    });

    await services.sync.deleteNote({
      accountId: 'reader-a',
      noteId: remoteBacked.id,
    });
    await services.sync.deleteNote({
      accountId: 'reader-a',
      noteId: unsent.id,
    });

    await services.database.close();
    services = await createServices(databaseName);
    await services.sync.initialize();

    await expect(
      services.annotations.getAllNotesInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([]);
    await expect(
      services.annotations.getAllNotesInOwnerScope('qf:reader-b'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: otherAccount.id,
        content: 'reader b note',
      }),
    ]);
    await expect(services.sync.getOutboxEntries('reader-a')).resolves.toEqual([
      expect.objectContaining({
        resource: 'NOTE',
        mutationType: 'DELETE',
        localId: remoteBacked.id,
        remoteId: 'remote-note-1',
        ownerScope: 'qf:reader-a',
      }),
    ]);

    await services.database.close();
  });

  it('rolls back local note deletion when enqueue fails inside the same SQLite transaction', async () => {
    const {database, annotations, sync} = await createServices(
      'qf-note-delete-rollback.db',
    );
    await sync.initialize();

    const note = await sync.addNote({
      accountId: 'reader-a',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      content: 'delete rollback note',
      rewayahId: 'warsh',
    });
    const [createOperation] = await sync.getOutboxEntries('reader-a');
    await sync.acknowledgeOperation({
      accountId: 'reader-a',
      localOperationId: createOperation.localOperationId,
      resourceId: 'remote-note-rollback',
      serverCreatedAt: 6101,
      serverUpdatedAt: 6101,
    });

    const connection = (await database.getConnection()) as TestDatabase;
    const originalRunAsync = connection.runAsync.bind(connection);
    let injected = false;
    connection.runAsync = async (source, params) => {
      if (!injected && source.includes('INSERT INTO qf_sync_outbox')) {
        injected = true;
        throw new Error('inject delete enqueue failure');
      }

      return originalRunAsync(source, params);
    };

    await expect(
      sync.deleteNote({
        accountId: 'reader-a',
        noteId: note.id,
      }),
    ).rejects.toThrow('inject delete enqueue failure');

    await expect(
      annotations.getAllNotesInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: note.id,
        content: 'delete rollback note',
        remoteId: 'remote-note-rollback',
      }),
    ]);
    await expect(sync.getOutboxEntries('reader-a')).resolves.toEqual([]);

    await database.close();
  });

  it('applies a newer remote note as canonical and preserves the pending local edit as a visible conflict copy', async () => {
    const {database, annotations, sync} = await createServices(
      'qf-note-conflict.db',
    );
    await sync.initialize();

    const note = await sync.addNote({
      accountId: 'reader-a',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      content: 'local draft',
      verseKeys: ['2:255', '2:256'],
      rewayahId: 'warsh',
    });
    const [createOperation] = await sync.getOutboxEntries('reader-a');

    await sync.acknowledgeOperation({
      accountId: 'reader-a',
      localOperationId: createOperation.localOperationId,
      resourceId: 'remote-note-1',
      serverCreatedAt: 6001,
      serverUpdatedAt: 6001,
    });
    await sync.updateNote({
      accountId: 'reader-a',
      noteId: note.id,
      content: 'pending local edit',
    });

    await sync.applyRemoteNote({
      accountId: 'reader-a',
      remoteId: 'remote-note-1',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      content: 'remote canonical edit',
      verseKeys: ['2:255', '2:257'],
      serverCreatedAt: 6001,
      serverUpdatedAt: 7001,
    });

    await expect(
      annotations.getAllNotesInOwnerScope('qf:reader-a'),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: note.id,
          content: 'remote canonical edit',
          verseKeys: ['2:255', '2:257'],
          remoteId: 'remote-note-1',
          serverCreatedAt: 6001,
          serverUpdatedAt: 7001,
        }),
        expect.objectContaining({
          content: 'pending local edit',
          ownerScope: 'qf:reader-a',
        }),
      ]),
    );

    const connection = (await database.getConnection()) as TestDatabase;
    await expect(
      connection.getAllAsync<{
        note_id: string;
        local_content: string;
        remote_content: string;
        remote_id: string | null;
        base_server_updated_at: number | null;
      }>(
        `SELECT note_id, local_content, remote_content, remote_id, base_server_updated_at
         FROM qf_note_conflicts
         WHERE owner_scope = ?
         ORDER BY created_at`,
        ['qf:reader-a'],
      ),
    ).resolves.toEqual([
      {
        note_id: note.id,
        local_content: 'pending local edit',
        remote_content: 'remote canonical edit',
        remote_id: 'remote-note-1',
        base_server_updated_at: 6001,
      },
    ]);

    await expect(sync.getOutboxEntries('reader-a')).resolves.toEqual([
      expect.objectContaining({
        resource: 'NOTE',
        mutationType: 'CREATE',
        remoteId: null,
      }),
    ]);
    const retryPayload = JSON.parse(
      (await sync.getOutboxEntries('reader-a'))[0].payloadJson,
    );
    expect(retryPayload).toEqual(
      expect.objectContaining({
        content: 'pending local edit',
      }),
    );
    expect(retryPayload).not.toHaveProperty('remoteId');

    await database.close();
  });

  it('ignores stale or equal remote notes while a local edit is pending', async () => {
    const {database, annotations, sync} = await createServices(
      'qf-note-stale-remote.db',
    );
    await sync.initialize();

    const note = await sync.addNote({
      accountId: 'reader-a',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      content: 'local draft',
      verseKeys: ['2:255'],
      rewayahId: 'warsh',
    });
    const [createOperation] = await sync.getOutboxEntries('reader-a');
    await sync.acknowledgeOperation({
      accountId: 'reader-a',
      localOperationId: createOperation.localOperationId,
      resourceId: 'remote-note-1',
      serverCreatedAt: 6001,
      serverUpdatedAt: 6001,
    });
    await sync.updateNote({
      accountId: 'reader-a',
      noteId: note.id,
      content: 'pending local edit',
    });

    await sync.applyRemoteNote({
      accountId: 'reader-a',
      remoteId: 'remote-note-1',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      content: 'equal stale replay',
      verseKeys: ['2:255'],
      serverCreatedAt: 6001,
      serverUpdatedAt: 6001,
    });
    await sync.applyRemoteNote({
      accountId: 'reader-a',
      remoteId: 'remote-note-1',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      content: 'older stale replay',
      verseKeys: ['2:255'],
      serverCreatedAt: 6001,
      serverUpdatedAt: 5001,
    });

    await expect(
      annotations.getAllNotesInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: note.id,
        content: 'pending local edit',
        remoteId: 'remote-note-1',
        serverUpdatedAt: 6001,
      }),
    ]);
    await expect(sync.getOutboxEntries('reader-a')).resolves.toEqual([
      expect.objectContaining({
        resource: 'NOTE',
        mutationType: 'UPDATE',
        baseServerUpdatedAt: 6001,
      }),
    ]);

    const connection = (await database.getConnection()) as TestDatabase;
    await expect(
      connection.getFirstAsync<{count: number}>(
        `SELECT COUNT(*) AS count FROM qf_note_conflicts WHERE owner_scope = ?`,
        ['qf:reader-a'],
      ),
    ).resolves.toEqual({count: 0});

    await database.close();
  });
});
