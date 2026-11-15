// @ai-generated
/**
 * The bundled databases a phone keeps by name: assets/data/quran-search-v1.db
 * (services/search/QuranSearchDataService.ts), irab-v1.db
 * (services/irab/IrabDataService.ts), gharib-v1.db and rasm-v1.db
 * (services/wordStudy/bundledWordStudy.ts).
 *
 * expo-sqlite's importDatabaseFromAssetAsync does nothing when a database of
 * that name already exists (the services never pass forceOverwrite), and the
 * services only import again a copy that is incomplete or of another
 * format. So new bytes under an old name never reach a phone that has the
 * old file: a rebuilt database must ship under a new name. Nothing else
 * enforces that, so bundledDatabases.sha256.json records the sha256 of each
 * file under its versioned name, and this test fails when a file's bytes
 * change while its name stays the same. It also runs each service as on a
 * first launch, to check that it opens and imports the database under the
 * name of the asset it imports: a service that kept an old name would keep
 * the old copy too.
 *
 * Fix a failure by bumping the version in the file name (gharib-v2.db) and
 * in every reference to it, then recording the new name in the JSON; or,
 * while the file has never shipped in a release, by updating its sha256 in
 * the JSON deliberately.
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import record from './bundledDatabases.sha256.json';
import {IRAB_DB_NAME} from '@/constants/bundledDatabases';
import {BUNDLED_WORD_STUDY} from '@/services/wordStudy/bundledWordStudy';
import {QURAN_SEARCH_DB_NAME} from '@/utils/search/quranIndexFormat';
import {
  closeOpenDatabases,
  registerAssetFile,
  // Not a React hook, whatever its name says.
  useDatabaseDir as setDatabaseDir,
} from '@/test-utils/mockExpoSqlite';

jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);

jest.setTimeout(60_000);

const ROOT = path.join(__dirname, '../../..');
const ASSETS = path.join(ROOT, 'assets/data');
const RECORD = 'services/search/__tests__/bundledDatabases.sha256.json';

interface Bundled {
  name: string;
  /** Where the name and the asset's require() are written. */
  references: readonly string[];
  /** The file that require()s the asset. */
  requiredIn: string;
  /**
   * Opens the database with the app's own service. It runs inside
   * jest.isolateModulesAsync, so it loads the service afresh.
   */
  open: () => Promise<unknown>;
}

/** The databases imported once and kept by name, as the code names them. */
function bundled(): Bundled[] {
  const out: Bundled[] = [
    {
      name: QURAN_SEARCH_DB_NAME,
      references: [
        'utils/search/quranIndexFormat.ts (QURAN_SEARCH_DB_NAME)',
        'services/search/QuranSearchDataService.ts (require)',
      ],
      requiredIn: 'services/search/QuranSearchDataService.ts',
      open: () =>
        require('@/services/search/QuranSearchDataService').quranSearchDataService.initialize(),
    },
    {
      name: IRAB_DB_NAME,
      references: [
        'constants/bundledDatabases.ts (IRAB_DB_NAME)',
        'services/irab/IrabDataService.ts (require, OLD_DB_NAMES)',
      ],
      requiredIn: 'services/irab/IrabDataService.ts',
      open: () =>
        require('@/services/irab/IrabDataService').irabDataService.initialize(),
    },
  ];
  for (const kind of ['gharib', 'rasm'] as const) {
    const db = BUNDLED_WORD_STUDY[kind];
    if (!db) continue; // A kind that does not ship is never imported.
    out.push({
      name: db.name,
      references: [
        'services/wordStudy/bundledWordStudy.ts (name, require, old names)',
      ],
      requiredIn: 'services/wordStudy/bundledWordStudy.ts',
      open: () => {
        const {
          WordStudyDataService,
        } = require('@/services/wordStudy/WordStudyDataService');
        const table =
          require('@/services/wordStudy/bundledWordStudy').BUNDLED_WORD_STUDY;
        // This kind's entry of the app's table only. getVerse never
        // rejects: a failed open shows in the SQLite calls.
        return new WordStudyDataService({
          gharib: null,
          rasm: null,
          [kind]: table[kind],
        }).getVerse('1:1');
      },
    });
  }
  return out;
}

const recorded = record as Record<string, string>;

function sha256(file: string): string {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(file))
    .digest('hex');
}

function nextVersion(name: string): string {
  return name.replace(/-v(\d+)\.db$/, (_m, v) => `-v${Number(v) + 1}.db`);
}

/**
 * The asset id of a bundled database. In the app each require() of a .db
 * gives its own id; Jest gives every one the id 1, so launch() maps each to
 * its own.
 */
const assetOf = (name: string) => `asset:${name}`;

interface Launch {
  /** The database names the service opened, first use first. */
  opened: string[];
  /** Each import, as 'name ← asset'. */
  imported: string[];
}

type SqliteFn = (...args: never[]) => unknown;

/**
 * Runs `db.open()` on a phone whose database folder is `dir`, with each
 * bundled asset its own id, and returns the service's SQLite calls.
 */
async function launch(db: Bundled, dir: string): Promise<Launch> {
  // The double the services use (loaded by the jest.mock above).
  const sqlite = jest.requireMock<Record<string, SqliteFn>>('expo-sqlite');
  const own = {...sqlite};
  const opened: string[] = [];
  const imported: string[] = [];
  sqlite.openDatabaseAsync = ((name: string) => {
    if (!opened.includes(name)) opened.push(name);
    return own.openDatabaseAsync(name as never);
  }) as SqliteFn;
  sqlite.importDatabaseFromAssetAsync = ((
    name: string,
    source: {assetId: unknown},
  ) => {
    imported.push(`${name} ← ${String(source.assetId)}`);
    return own.importDatabaseFromAssetAsync(name as never, source as never);
  }) as SqliteFn;
  const files = bundled().map(other => path.join(ASSETS, other.name));
  setDatabaseDir(dir);
  try {
    await jest.isolateModulesAsync(async () => {
      for (const other of bundled()) {
        const file = path.join(ASSETS, other.name);
        jest.doMock(file, () => assetOf(other.name));
        registerAssetFile(assetOf(other.name), file);
      }
      await db.open();
    });
  } finally {
    Object.assign(sqlite, own);
    for (const file of files) jest.dontMock(file);
    await closeOpenDatabases();
  }
  return {opened, imported};
}

let dir = '';
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundled-db-'));
});
afterEach(() => {
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('bundled databases kept by name', () => {
  it('records exactly the databases the app ships', () => {
    const names = bundled()
      .map(db => db.name)
      .sort();
    expect({record: RECORD, names: Object.keys(recorded).sort()}).toEqual({
      record: RECORD,
      names,
    });
  });

  it.each(bundled().map(db => [db.name, db] as const))(
    '%s is versioned and is the file the app requires',
    (name, db) => {
      expect(name).toMatch(/^[a-z][a-z-]*-v\d+\.db$/);
      expect(fs.existsSync(path.join(ASSETS, name))).toBe(true);
      const source = fs.readFileSync(path.join(ROOT, db.requiredIn), 'utf8');
      expect(source).toContain(`require('../../assets/data/${name}')`);
    },
  );

  it.each(bundled().map(db => [db.name, db] as const))(
    '%s has the bytes recorded under its name',
    (name, db) => {
      const actual = sha256(path.join(ASSETS, name));
      const expected = recorded[name];
      if (actual !== expected) {
        const asset = `assets/data/${name}`;
        throw new Error(
          [
            `${asset} changed (sha256 ${expected ?? 'none'} → ${actual}) but kept its name.`,
            `A phone that has ${name} keeps its copy: expo-sqlite imports a bundled database once per name.`,
            `Either bump the version in the file name (${nextVersion(name)}) and in every reference:`,
            ...db.references.map(ref => `  - ${ref}`),
            `  and record the new name in ${RECORD};`,
            `or, while ${name} has never shipped in a release, update its sha256 there deliberately:`,
            `  "${name}": "${actual}"`,
            `The releases that have it (empty: none; needs the tags, git fetch --tags):`,
            `  git tag --contains $(git log --diff-filter=A --format=%h -- ${asset} | tail -1)`,
          ].join('\n'),
        );
      }
      expect(actual).toBe(expected);
    },
  );
});

describe('each service imports its database under the name of its asset', () => {
  it.each(bundled().map(db => [db.name, db] as const))(
    '%s on a first launch',
    async (name, db) => {
      // A service that opens another name than the asset it imports (a
      // rename that missed its DB_NAME) would keep a phone's old copy.
      expect(await launch(db, dir)).toEqual({
        opened: [name],
        imported: [`${name} ← ${assetOf(name)}`],
      });
    },
  );
});

describe('a phone keeps the copy it has', () => {
  it.each(bundled().map(db => [db.name, db] as const))(
    '%s: the service opens its own copy, not the new asset of that name',
    async (name, db) => {
      // The copy an earlier build installed, told apart by one table.
      const installed = path.join(dir, name);
      fs.copyFileSync(path.join(ASSETS, name), installed);
      const old = new Database(installed);
      old.exec('CREATE TABLE installed_earlier (id INTEGER)');
      old.close();

      // The app's own service, after an update that kept the name.
      await launch(db, dir);

      const kept = new Database(installed, {readonly: true});
      const marker = kept
        .prepare(
          "SELECT name FROM sqlite_master WHERE name = 'installed_earlier'",
        )
        .get();
      kept.close();
      expect(marker).toEqual({name: 'installed_earlier'});
    },
  );
});
