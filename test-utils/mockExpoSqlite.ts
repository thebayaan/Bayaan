import fs from 'fs';
import os from 'os';
import path from 'path';
import {openAdapterDatabase, type AdapterDatabase} from './sqliteAdapter';

// @ai-start
// The mock makes its folder on first use, and resetDatabases() removes it.
// Before, each import and each reset left a folder in the temp directory
// (about 1 GB for each full Jest run). A process 'exit' handler cannot do this
// job: in a Jest test, `process` is a copy, and its 'exit' event never fires.
let currentDir: string | null = null;
// True only for a folder that this mock made. A folder that a caller gives to
// useDatabaseDir() stays with the caller.
let ownsCurrentDir = false;
const open = new Map<string, AdapterDatabase>();

export function databaseDir(): string {
  if (currentDir === null) {
    currentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-sqlite-'));
    ownsCurrentDir = true;
  }
  return currentDir;
}
// @ai-end

// Closes every open handle but keeps the current directory, so a fresh set of
// service instances can reopen the same files (simulates an app relaunch).
export async function closeOpenDatabases(): Promise<void> {
  for (const db of open.values()) await db.closeAsync();
  open.clear();
}

export function useDatabaseDir(dir: string): void {
  currentDir = dir;
  ownsCurrentDir = false; // @ai
}

// Called in beforeEach for isolation; closes handles, removes the directory and
// starts a new one on the next use.
export async function resetDatabases(): Promise<void> {
  for (const db of open.values()) await db.closeAsync();
  open.clear();
  // @ai-start
  if (currentDir !== null && ownsCurrentDir) {
    fs.rmSync(currentDir, {recursive: true, force: true});
  }
  currentDir = null;
  ownsCurrentDir = false;
  // @ai-end
}

export const expoSqliteModule = {
  openDatabaseAsync: async (name: string): Promise<AdapterDatabase> => {
    const existing = open.get(name);
    if (existing) return existing;
    const db = openAdapterDatabase(path.join(databaseDir(), name)); // @ai
    // Real expo-sqlite opens a fresh connection after closeAsync(), so drop
    // the cached handle when a service closes it.
    const close = db.closeAsync.bind(db);
    db.closeAsync = async (): Promise<void> => {
      if (open.get(name) === db) open.delete(name);
      await close();
    };
    open.set(name, db);
    return db;
  },
};

export const openDatabaseAsync = expoSqliteModule.openDatabaseAsync;
