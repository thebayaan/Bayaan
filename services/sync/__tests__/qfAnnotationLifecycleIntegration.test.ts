jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.setTimeout(20_000);

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
  runAsync(
    source: string,
    params?: unknown[] | Record<string, unknown>,
  ): Promise<unknown>;
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
    await sqlite3.exec(await this.dbPromise, source);
  }

  async runAsync(
    source: string,
    params: unknown[] | Record<string, unknown> = [],
  ): Promise<unknown> {
    const {sqlite3} = await sqlitePromise;
    const db = await this.dbPromise;
    for await (const statement of sqlite3.statements(db, source)) {
      sqlite3.bind_collection(statement, params);
      await sqlite3.step(statement);
    }
    return {changes: sqlite3.changes(db)};
  }

  async getAllAsync<T extends Record<string, unknown>>(
    source: string,
    params: unknown[] | Record<string, unknown> = [],
  ): Promise<T[]> {
    const {sqlite3, SQLite} = await sqlitePromise;
    const db = await this.dbPromise;
    const rows: T[] = [];
    for await (const statement of sqlite3.statements(db, source)) {
      sqlite3.bind_collection(statement, params);
      const names = sqlite3.column_names(statement);
      while ((await sqlite3.step(statement)) === SQLite.SQLITE_ROW) {
        const values = sqlite3.row(statement);
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
    return (await this.getAllAsync<T>(source, params))[0] ?? null;
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
    await sqlite3.close(await this.dbPromise);
  }
}

const mockOpenDatabaseAsync = jest.fn(
  async (databaseName: string) => new ExpoSqliteWasmDatabase(databaseName),
);

import type {ReactTestRenderer} from 'react-test-renderer';
import type {QfSyncLifecycleContext} from '@/services/sync/qfSyncLifecycle';

let React: typeof import('react');
let renderer: typeof import('react-test-renderer');
let act: typeof import('react-test-renderer').act;
let verseAnnotationDatabase: typeof import('@/services/database/VerseAnnotationDatabase').verseAnnotationDatabase;
let qfSyncDatabaseService: typeof import('@/services/sync/qfSyncDatabaseService').qfSyncDatabaseService;
let QfSyncLifecycle: typeof import('@/services/sync/qfSyncLifecycle').QfSyncLifecycle;
let verseAnnotationService: typeof import('@/services/verse-annotations/VerseAnnotationService').verseAnnotationService;
let useVerseActions: typeof import('@/hooks/useVerseActions').useVerseActions;
let useQfSyncStore: typeof import('@/store/qfSyncStore').useQfSyncStore;
let useVerseAnnotationsStore: typeof import('@/store/verseAnnotationsStore').useVerseAnnotationsStore;

const authenticatedOffline: QfSyncLifecycleContext = {
  authStatus: 'authenticated',
  accountId: 'account-a',
  online: false,
  appActive: true,
};

function deferred<T = void>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return {promise, resolve};
}

function createLifecycle(
  overrides: Partial<ConstructorParameters<typeof QfSyncLifecycle>[0]> = {},
) {
  return new QfSyncLifecycle({
    enabled: true,
    coordinator: {
      pull: jest.fn(async () => ({
        status: 'synced' as const,
        head: 10,
        restarts: 0,
      })),
      push: jest.fn(async () => ({status: 'idle' as const, head: 10})),
    },
    guestImportService: {
      getOffer: jest.fn(async () => null),
      merge: jest.fn(),
      keepSeparate: jest.fn(),
    },
    database: qfSyncDatabaseService,
    getSession: jest.fn(async () => ({
      token: 'opaque-bayaan-session',
      expiresAt: 99_999,
      profile: {accountId: 'account-a'},
    })),
    onSessionRevoked: jest.fn(async () => undefined),
    flushReadingSession: jest.fn(async () => undefined),
    getReadingIntentRevision: jest.fn(() => 0),
    ...overrides,
  });
}

async function pauseNextWrite(sqlFragment: string) {
  const connection =
    (await verseAnnotationDatabase.getConnection()) as unknown as TestDatabase;
  const originalRunAsync = connection.runAsync.bind(connection);
  const entered = deferred();
  const release = deferred();
  let paused = false;
  connection.runAsync = async (source, params) => {
    if (!paused && source.includes(sqlFragment)) {
      paused = true;
      entered.resolve();
      await release.promise;
    }
    return originalRunAsync(source, params);
  };
  return {
    entered: entered.promise,
    release: () => release.resolve(),
    restore: () => {
      connection.runAsync = originalRunAsync;
    },
  };
}

beforeAll(async () => {
  jest.resetModules();
  jest.doMock('expo-sqlite', () => ({
    openDatabaseAsync: mockOpenDatabaseAsync,
  }));
  jest.doMock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
  );
  React = require('react');
  renderer = require('react-test-renderer');
  act = renderer.act;
  ({
    verseAnnotationDatabase,
  } = require('@/services/database/VerseAnnotationDatabase'));
  ({qfSyncDatabaseService} = require('@/services/sync/qfSyncDatabaseService'));
  ({QfSyncLifecycle} = require('@/services/sync/qfSyncLifecycle'));
  ({
    verseAnnotationService,
  } = require('@/services/verse-annotations/VerseAnnotationService'));
  ({useVerseActions} = require('@/hooks/useVerseActions'));
  ({useQfSyncStore} = require('@/store/qfSyncStore'));
  ({useVerseAnnotationsStore} = require('@/store/verseAnnotationsStore'));
  await verseAnnotationDatabase.initialize();
});

beforeEach(async () => {
  useQfSyncStore.getState().resetForTesting();
  useVerseAnnotationsStore.getState().clearActiveView();
  const connection =
    (await verseAnnotationDatabase.getConnection()) as unknown as TestDatabase;
  await connection.execAsync(`
    DELETE FROM qf_sync_outbox;
    DELETE FROM bookmarks;
    DELETE FROM notes;
    DELETE FROM highlights;
    DELETE FROM qf_reading_locations;
    DELETE FROM qf_sync_state;
  `);
});

afterAll(async () => {
  await verseAnnotationDatabase.close();
});

it('waits for a real SQLite mutation started after stop begins', async () => {
  const flush = deferred();
  const lifecycle = createLifecycle({
    flushReadingSession: jest.fn((accountId?: string) =>
      accountId === 'account-a' ? flush.promise : Promise.resolve(),
    ),
  });
  lifecycle.updateContext(authenticatedOffline);
  await lifecycle.waitForIdle();
  const pausedWrite = await pauseNextWrite('INSERT INTO bookmarks');

  let stopped = false;
  const stop = lifecycle.stop().then(() => {
    stopped = true;
  });
  const write = verseAnnotationService.addBookmark('2:255', 2, 255, 'hafs');
  await pausedWrite.entered;

  flush.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(stopped).toBe(false);

  pausedWrite.release();
  await Promise.all([write, stop]);
  pausedWrite.restore();
  const connection =
    (await verseAnnotationDatabase.getConnection()) as unknown as TestDatabase;
  expect(
    await connection.getFirstAsync<{owner_scope: string; verse_key: string}>(
      'SELECT owner_scope, verse_key FROM bookmarks WHERE verse_key = ?',
      ['2:255'],
    ),
  ).toEqual({owner_scope: 'qf:account-a', verse_key: '2:255'});
  expect(
    await connection.getFirstAsync<{account_id: string; resource: string}>(
      'SELECT account_id, resource FROM qf_sync_outbox',
    ),
  ).toEqual({account_id: 'account-a', resource: 'BOOKMARK'});
});

it('keeps draining real SQLite mutations while stop waits for the current sync run', async () => {
  const pullEntered = deferred();
  const finishPull = deferred<{
    status: 'synced';
    head: number;
    restarts: number;
  }>();
  const lifecycle = createLifecycle({
    coordinator: {
      pull: jest.fn(() => {
        pullEntered.resolve();
        return finishPull.promise;
      }),
      push: jest.fn(async () => ({status: 'idle' as const, head: 10})),
    },
  });
  lifecycle.updateContext({...authenticatedOffline, online: true});
  await pullEntered.promise;
  const pausedWrite = await pauseNextWrite('INSERT INTO bookmarks');

  let stopped = false;
  const stop = lifecycle.stop().then(() => {
    stopped = true;
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  const write = verseAnnotationService.addBookmark('3:7', 3, 7, 'hafs');
  await pausedWrite.entered;

  finishPull.resolve({status: 'synced', head: 10, restarts: 0});
  await new Promise(resolve => setTimeout(resolve, 0));
  const stoppedWhileWritePaused = stopped;
  pausedWrite.release();
  await Promise.all([write, stop]);
  pausedWrite.restore();

  const connection =
    (await verseAnnotationDatabase.getConnection()) as unknown as TestDatabase;
  expect(
    await connection.getFirstAsync<{owner_scope: string; verse_key: string}>(
      'SELECT owner_scope, verse_key FROM bookmarks WHERE verse_key = ?',
      ['3:7'],
    ),
  ).toEqual({owner_scope: 'qf:account-a', verse_key: '3:7'});
  expect(stoppedWhileWritePaused).toBe(false);
});

it('finishes stop when the account changes while its current sync run is pending', async () => {
  const pullEntered = deferred();
  const finishPull = deferred<{
    status: 'synced';
    head: number;
    restarts: number;
  }>();
  const lifecycle = createLifecycle({
    coordinator: {
      pull: jest.fn(() => {
        pullEntered.resolve();
        return finishPull.promise;
      }),
      push: jest.fn(async () => ({status: 'idle' as const, head: 10})),
    },
  });
  lifecycle.updateContext({...authenticatedOffline, online: true});
  await pullEntered.promise;

  let stopSettled = false;
  const stop = lifecycle.stop().then(() => {
    stopSettled = true;
  });
  lifecycle.updateContext({...authenticatedOffline, accountId: 'account-b'});
  finishPull.resolve({status: 'synced', head: 10, restarts: 0});
  await new Promise(resolve => setTimeout(resolve, 0));

  expect(stopSettled).toBe(true);
  await stop;
  await lifecycle.waitForIdle();
  expect(useQfSyncStore.getState().activeAccountId).toBe('account-b');
});

it('drains a real old-scope mutation before surfacing a rejected reading flush', async () => {
  const readingFailure = new Error('reading persistence failed');
  const lifecycle = createLifecycle({
    flushReadingSession: jest.fn((accountId?: string) =>
      accountId === 'account-a'
        ? Promise.reject(readingFailure)
        : Promise.resolve(),
    ),
  });
  lifecycle.updateContext(authenticatedOffline);
  await lifecycle.waitForIdle();
  const pausedWrite = await pauseNextWrite('INSERT INTO bookmarks');

  let stopSettled = false;
  const stopResult = lifecycle.stop().then(
    () => {
      stopSettled = true;
      return null;
    },
    error => {
      stopSettled = true;
      return error;
    },
  );
  const write = verseAnnotationService.addBookmark('18:10', 18, 10, 'hafs');
  await pausedWrite.entered;
  await new Promise(resolve => setTimeout(resolve, 0));
  const stopSettledWhileWritePaused = stopSettled;

  pausedWrite.release();
  const [, stopError] = await Promise.all([write, stopResult]);
  pausedWrite.restore();
  const connection =
    (await verseAnnotationDatabase.getConnection()) as unknown as TestDatabase;
  expect(
    await connection.getFirstAsync<{account_id: string; resource: string}>(
      'SELECT account_id, resource FROM qf_sync_outbox',
    ),
  ).toEqual({account_id: 'account-a', resource: 'BOOKMARK'});
  expect(stopSettledWhileWritePaused).toBe(false);
  expect(stopError).toBe(readingFailure);
});

it('keeps a paused local highlight visible after a same-account pull refresh', async () => {
  const lifecycle = createLifecycle();
  lifecycle.updateContext(authenticatedOffline);
  await lifecycle.waitForIdle();
  await useVerseAnnotationsStore.getState().loadAnnotationsForSurah(2);

  let actions: ReturnType<typeof useVerseActions> | null = null;
  function ActionsHarness() {
    actions = useVerseActions();
    return null;
  }
  let screen: ReactTestRenderer | null = null;
  await act(async () => {
    screen = renderer.create(React.createElement(ActionsHarness) as never);
  });
  const capturedActions = actions as ReturnType<typeof useVerseActions> | null;
  if (!capturedActions) throw new Error('verse actions hook did not render');

  const pausedWrite = await pauseNextWrite('INSERT INTO highlights');
  let write: Promise<void> = Promise.resolve();
  await act(async () => {
    write = capturedActions.setHighlight('2:255', 2, 255, 'purple');
    await pausedWrite.entered;
  });

  lifecycle.updateContext({...authenticatedOffline, online: true});
  await lifecycle.waitForIdle();
  expect(useVerseAnnotationsStore.getState().getHighlightColor('2:255')).toBe(
    null,
  );

  pausedWrite.release();
  await act(async () => {
    await write;
  });
  pausedWrite.restore();
  expect(useVerseAnnotationsStore.getState().getHighlightColor('2:255')).toBe(
    'purple',
  );
  expect(await verseAnnotationService.getHighlightsBySurah(2)).toEqual([
    expect.objectContaining({
      ownerScope: 'qf:account-a',
      verseKey: '2:255',
      color: 'purple',
    }),
  ]);

  await act(async () => {
    screen?.unmount();
  });
});
