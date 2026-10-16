import fs from 'fs';
import os from 'os';
import path from 'path';
import {openAdapterDatabase, type AdapterDatabase} from './sqliteAdapter';

let currentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-sqlite-'));
const open = new Map<string, AdapterDatabase>();

export function databaseDir(): string {
  return currentDir;
}

// Closes every open handle but keeps the current directory, so a fresh set of
// service instances can reopen the same files (simulates an app relaunch).
export async function closeOpenDatabases(): Promise<void> {
  for (const db of open.values()) await db.closeAsync();
  open.clear();
}

export function useDatabaseDir(dir: string): void {
  currentDir = dir;
}

// Called in beforeEach for isolation; closes handles and starts a new directory.
export async function resetDatabases(): Promise<void> {
  for (const db of open.values()) await db.closeAsync();
  open.clear();
  currentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-sqlite-'));
}

export const expoSqliteModule = {
  openDatabaseAsync: async (name: string): Promise<AdapterDatabase> => {
    const existing = open.get(name);
    if (existing) return existing;
    const db = openAdapterDatabase(path.join(currentDir, name));
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
