import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  databaseDir,
  openDatabaseAsync,
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
