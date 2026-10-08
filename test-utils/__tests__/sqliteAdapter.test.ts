import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';
import {openAdapterDatabase, toLocalError} from '../sqliteAdapter';

function tempFile(): string {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite-adapter-')),
    'test.db',
  );
}

describe('sqlite adapter', () => {
  it('runs multi-statement execAsync and binds array, spread and named params', async () => {
    const db = openAdapterDatabase(tempFile());
    await db.execAsync(
      'CREATE TABLE t (id INTEGER PRIMARY KEY, a TEXT, b INTEGER); CREATE INDEX t_a ON t(a);',
    );
    const first = await db.runAsync('INSERT INTO t (a, b) VALUES (?, ?)', [
      'x',
      1,
    ]);
    await db.runAsync('INSERT INTO t (a, b) VALUES (?, ?)', 'y', 2);
    await db.runAsync('INSERT INTO t (a, b) VALUES ($a, $b)', {$a: 'z', $b: 3});
    expect(first).toEqual({lastInsertRowId: 1, changes: 1});
    expect(
      await db.getAllAsync<{a: string}>('SELECT a FROM t ORDER BY id'),
    ).toEqual([{a: 'x'}, {a: 'y'}, {a: 'z'}]);
    expect(
      await db.getFirstAsync<{b: number}>('SELECT b FROM t WHERE a = ?', ['y']),
    ).toEqual({b: 2});
    expect(
      await db.getFirstAsync('SELECT b FROM t WHERE a = ?', 'missing'),
    ).toBeNull();
  });

  it('rolls back withTransactionAsync on error and commits on success', async () => {
    const db = openAdapterDatabase(tempFile());
    await db.execAsync('CREATE TABLE t (v INTEGER)');
    await expect(
      db.withTransactionAsync(async () => {
        await db.runAsync('INSERT INTO t (v) VALUES (1)');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await db.withTransactionAsync(async () => {
      await db.runAsync('INSERT INTO t (v) VALUES (2)');
    });
    expect(await db.getAllAsync('SELECT v FROM t')).toEqual([{v: 2}]);
  });

  it('maps booleans to integers like expo-sqlite', async () => {
    const db = openAdapterDatabase(tempFile());
    await db.execAsync('CREATE TABLE t (f INTEGER)');
    await db.runAsync('INSERT INTO t (f) VALUES (?)', [true]);
    expect(await db.getFirstAsync('SELECT f FROM t')).toEqual({f: 1});
  });

  it('persists to disk across reopen and closes cleanly', async () => {
    const file = tempFile();
    const db = openAdapterDatabase(file);
    await db.execAsync('CREATE TABLE t (v TEXT)');
    await db.runAsync('INSERT INTO t (v) VALUES (?)', ['kept']);
    await db.closeAsync();
    const reopened = openAdapterDatabase(file);
    expect(await reopened.getAllAsync('SELECT v FROM t')).toEqual([
      {v: 'kept'},
    ]);
  });

  it('rejects nested withTransactionAsync and rolls the outer transaction back', async () => {
    const db = openAdapterDatabase(tempFile());
    await db.execAsync('CREATE TABLE t (v INTEGER)');
    await expect(
      db.withTransactionAsync(async () => {
        await db.runAsync('INSERT INTO t (v) VALUES (1)');
        await db.withTransactionAsync(async () => undefined);
      }),
    ).rejects.toThrow(
      'nested withTransactionAsync is not supported by expo-sqlite',
    );
    expect(await db.getAllAsync('SELECT v FROM t')).toEqual([]);
    await db.withTransactionAsync(async () => {
      await db.runAsync('INSERT INTO t (v) VALUES (3)');
    });
    expect(await db.getAllAsync('SELECT v FROM t')).toEqual([{v: 3}]);
  });

  it('throws for named params without a $, : or @ prefix', async () => {
    const db = openAdapterDatabase(tempFile());
    await db.execAsync('CREATE TABLE t (a TEXT)');
    await expect(
      db.runAsync('INSERT INTO t (a) VALUES ($a)', {a: 'x'}),
    ).rejects.toThrow('named SQL parameters must be prefixed with $, : or @');
  });

  it('round-trips Uint8Array blobs and null params', async () => {
    const db = openAdapterDatabase(tempFile());
    await db.execAsync('CREATE TABLE t (b BLOB, n TEXT)');
    await db.runAsync('INSERT INTO t (b, n) VALUES (?, ?)', [
      new Uint8Array([1, 2, 3]),
      null,
    ]);
    const row = await db.getFirstAsync<{b: Uint8Array; n: string | null}>(
      'SELECT b, n FROM t',
    );
    expect(Array.from(row?.b ?? [])).toEqual([1, 2, 3]);
    expect(row?.n).toBeNull();
  });

  it('rejects SQL failures with an Error from the current realm', async () => {
    const db = openAdapterDatabase(tempFile());
    await db.execAsync('CREATE TABLE t (v TEXT NOT NULL)');
    const error = await db
      .runAsync('INSERT INTO t (v) VALUES (?)', [null])
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({code: 'SQLITE_CONSTRAINT_NOTNULL'});
  });

  // A reused Jest worker hands later test files SqliteErrors built in the
  // first file's realm; simulate that with an error from another VM context.
  it('rebuilds errors from another realm as local Errors', () => {
    const foreign: unknown = vm.runInNewContext(
      'const e = new Error("NOT NULL constraint failed"); e.code = "SQLITE_CONSTRAINT_NOTNULL"; e',
    );
    expect(foreign instanceof Error).toBe(false);
    const local = toLocalError(foreign);
    expect(local).toBeInstanceOf(Error);
    expect(local.message).toBe('NOT NULL constraint failed');
    expect(local).toMatchObject({code: 'SQLITE_CONSTRAINT_NOTNULL'});
    expect(() => {
      throw local;
    }).toThrow('NOT NULL constraint failed');
  });
});
