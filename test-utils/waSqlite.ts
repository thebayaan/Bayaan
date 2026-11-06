// Loads expo-sqlite's bundled wa-sqlite build for tests that need real SQLite
// semantics (transactions, constraints) under Node.
import fs from 'fs';
import path from 'path';
import {TextDecoder} from 'util';

export interface WaSqlite {
  // The wa-sqlite API object (`SQLite.Factory(module)`).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sqlite3: any;
  // The wa-sqlite constants and helpers module (`sqlite-api.js`).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SQLite: any;
}

const WA_SQLITE_DIR = path.join(
  process.cwd(),
  'node_modules',
  'expo-sqlite',
  'web',
  'wa-sqlite',
);

export async function loadWaSqlite(): Promise<WaSqlite> {
  (global as {TextDecoder?: unknown}).TextDecoder = TextDecoder;
  const ModuleFactory = require(path.join(WA_SQLITE_DIR, 'wa-sqlite.js'));
  const SQLite = require(path.join(WA_SQLITE_DIR, 'sqlite-api.js'));
  const wasmBinary = fs.readFileSync(
    path.join(WA_SQLITE_DIR, 'wa-sqlite.wasm'),
  );
  // SDK 58's build ignores a `wasmBinary` option, so instantiate the module
  // here and hand the instance over.
  const module = await ModuleFactory({
    instantiateWasm: (
      imports: WebAssembly.Imports,
      done: (instance: WebAssembly.Instance) => void,
    ) => {
      WebAssembly.instantiate(wasmBinary, imports).then(result =>
        done(result.instance),
      );
      return {};
    },
  });
  return {sqlite3: SQLite.Factory(module), SQLite};
}
