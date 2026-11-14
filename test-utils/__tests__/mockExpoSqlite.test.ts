// @ai-generated
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  clearAssetFiles,
  databaseDir,
  deleteDatabaseAsync,
  importDatabaseFromAssetAsync,
  openDatabaseAsync,
  registerAssetFile,
  resetDatabases,
} from '../mockExpoSqlite';

const fixtures = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-sqlite-assets-'));
const asset = path.join(fixtures, 'asset.db');

beforeAll(async () => {
  const Database = require('better-sqlite3');
  const db = new Database(asset);
  db.exec("CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('from the asset');");
  db.close();
});

afterAll(() => fs.rmSync(fixtures, {recursive: true, force: true}));

beforeEach(async () => {
  await resetDatabases();
  clearAssetFiles();
  registerAssetFile(7, asset);
});

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
  await db.execAsync("CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('mine');");
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
