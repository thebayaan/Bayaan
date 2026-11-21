import fs from 'fs';
import os from 'os';
import path from 'path';
import {openAdapterDatabase, type AdapterDatabase} from './sqliteAdapter';

// @ai-start
// The mock makes its folder on first use, in os.tmpdir(). jestGlobalSetup.js
// points that at a temp root for the Jest run and jestGlobalTeardown.js removes
// the root, so a suite tracks nothing, and a failed or crashed test leaves
// nothing. resetDatabases() removes the folder too, which keeps the disk use of
// a long run low.
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

// @ai-start
// Bundled databases: the file importDatabaseFromAssetAsync copies for an
// asset id (the number `require('x.db')` gives in the app).
const assetFiles = new Map<unknown, string>();

export function registerAssetFile(assetId: unknown, file: string): void {
  assetFiles.set(assetId, file);
}

export function clearAssetFiles(): void {
  assetFiles.clear();
}
// @ai-end

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
  // @ai-start
  // Copies the registered file into the database folder. Like expo-sqlite,
  // it does nothing when the database file already exists (unless
  // forceOverwrite), and fails for an asset it cannot find.
  importDatabaseFromAssetAsync: async (
    name: string,
    source: {assetId: unknown; forceOverwrite?: boolean},
  ): Promise<void> => {
    const file = assetFiles.get(source.assetId);
    if (!file) {
      throw new Error(
        `Unable to get the localUri from asset ${String(source.assetId)}`,
      );
    }
    const target = path.join(databaseDir(), name);
    if (fs.existsSync(target) && !source.forceOverwrite) return;
    fs.copyFileSync(file, target);
  },
  // Like expo-sqlite's native module: an open database or a missing file
  // cannot be deleted.
  deleteDatabaseAsync: async (name: string): Promise<void> => {
    if (open.has(name)) {
      throw new Error(
        `Unable to delete database '${name}' that is currently open. Close it prior to deletion.`,
      );
    }
    const target = path.join(databaseDir(), name);
    if (!fs.existsSync(target)) {
      throw new Error(`Database '${name}' not found`);
    }
    fs.rmSync(target);
  },
  // @ai-end
};

export const openDatabaseAsync = expoSqliteModule.openDatabaseAsync;
// @ai-start
export const importDatabaseFromAssetAsync =
  expoSqliteModule.importDatabaseFromAssetAsync;
export const deleteDatabaseAsync = expoSqliteModule.deleteDatabaseAsync;
// @ai-end
