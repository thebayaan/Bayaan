import {openDatabaseAsync, resetDatabases} from '../mockExpoSqlite';

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
});
