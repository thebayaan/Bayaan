import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  clearAssetFiles, // @ai
  databaseDir,
  deleteDatabaseAsync, // @ai
  importDatabaseFromAssetAsync, // @ai
  openDatabaseAsync,
  registerAssetFile, // @ai
  resetDatabases,
  useDatabaseDir,
} from '../mockExpoSqlite';

describe('expo-sqlite mock', () => {
  afterEach(async () => {
    await resetDatabases();
  });

  it('returns the same handle while open', async () => {
    const a = await openDatabaseAsync('same.db');
    const b = await openDatabaseAsync('same.db');
    expect(b).toBe(a);
  });

  it('opens a fresh connection after closeAsync, like the device', async () => {
    const first = await openDatabaseAsync('reopen.db');
    await first.execAsync(
      'CREATE TABLE t (v INTEGER); INSERT INTO t VALUES (7)',
    );
    await first.closeAsync();
    const second = await openDatabaseAsync('reopen.db');
    expect(second).not.toBe(first);
    const row = await second.getFirstAsync<{v: number}>('SELECT v FROM t');
    expect(row?.v).toBe(7);
  });

  // @ai-start
  it('makes its folder under the temp root of the run', () => {
    expect(path.basename(path.dirname(databaseDir()))).toMatch(
      /^bayaan-jest-tmp-\d+-/,
    );
  });

  it('removes the folder on each reset and makes a new one on the next use', async () => {
    const first = databaseDir();
    expect(fs.existsSync(first)).toBe(true);
    await resetDatabases();
    const second = databaseDir();
    await resetDatabases();
    const current = databaseDir();

    expect(fs.existsSync(first)).toBe(false);
    expect(fs.existsSync(second)).toBe(false);
    expect(fs.existsSync(current)).toBe(true);
    expect(new Set([first, second, current]).size).toBe(3);
  });

  it('removes the database files with the folder', async () => {
    const db = await openDatabaseAsync('removed.db');
    await db.execAsync('CREATE TABLE t (v INTEGER)');
    const file = path.join(databaseDir(), 'removed.db');
    expect(fs.existsSync(file)).toBe(true);

    await resetDatabases();

    expect(fs.existsSync(file)).toBe(false);
  });

  it('keeps a folder that the caller gave to useDatabaseDir', async () => {
    const callerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'caller-dir-'));
    try {
      useDatabaseDir(callerDir);
      await resetDatabases();
      expect(fs.existsSync(callerDir)).toBe(true);
    } finally {
      fs.rmSync(callerDir, {recursive: true, force: true});
    }
  });
  // @ai-end
});

// @ai-start
describe('expo-sqlite mock: bundled databases', () => {
  const fixtures = fs.mkdtempSync(
    path.join(os.tmpdir(), 'mock-sqlite-assets-'),
  );
  const asset = path.join(fixtures, 'asset.db');

  beforeAll(() => {
    const Database = require('better-sqlite3');
    const db = new Database(asset);
    db.exec(
      "CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('from the asset');",
    );
    db.close();
  });

  afterAll(() => fs.rmSync(fixtures, {recursive: true, force: true}));

  beforeEach(async () => {
    await resetDatabases();
    clearAssetFiles();
    registerAssetFile(7, asset);
  });

  afterEach(() => clearAssetFiles());

  const read = async (name: string) => {
    const db = await openDatabaseAsync(name);
    const rows = await db
      .getAllAsync<{v: string}>('SELECT v FROM t')
      .catch(() => []);
    await db.closeAsync();
    return rows.map(r => r.v);
  };

  it('imports a registered asset into the database folder', async () => {
    await importDatabaseFromAssetAsync('a.db', {assetId: 7});
    expect(await read('a.db')).toEqual(['from the asset']);
  });

  it('does nothing when the database already exists, like expo-sqlite', async () => {
    const db = await openDatabaseAsync('a.db');
    await db.execAsync(
      "CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('mine');",
    );
    await db.closeAsync();
    await importDatabaseFromAssetAsync('a.db', {assetId: 7});
    expect(await read('a.db')).toEqual(['mine']);
    await importDatabaseFromAssetAsync('a.db', {
      assetId: 7,
      forceOverwrite: true,
    });
    expect(await read('a.db')).toEqual(['from the asset']);
  });

  it('fails for an asset it does not know', async () => {
    await expect(
      importDatabaseFromAssetAsync('a.db', {assetId: 8}),
    ).rejects.toThrow(/asset 8/);
  });

  it('deletes a closed database, and refuses an open or missing one', async () => {
    await importDatabaseFromAssetAsync('a.db', {assetId: 7});
    const db = await openDatabaseAsync('a.db');
    await expect(deleteDatabaseAsync('a.db')).rejects.toThrow(/currently open/);
    await db.closeAsync();
    await deleteDatabaseAsync('a.db');
    expect(fs.existsSync(path.join(databaseDir(), 'a.db'))).toBe(false);
    await expect(deleteDatabaseAsync('a.db')).rejects.toThrow(/not found/);
  });
});
// @ai-end
