/**
 * Guards contract C4: services/mushaf/rewayahDataManifest.ts must hold the
 * sha256 of exactly the Digital Khatt DB assets DigitalKhattDataService
 * bundles. On-device copies are named from these hashes, so a stale manifest
 * would let installed apps keep reading an outdated copy of corrected text.
 *
 * The manifest also keys the saved layouts on the generated tables
 * (mushafTables.generated.ts), and gen-manifest.mjs fails while the tables are
 * stale against the DBs they were generated from.
 *
 * Fix a failure with: node scripts/rewayah/gen-mushaf-tables.mjs (when the
 * tables are stale), then node scripts/rewayah/gen-manifest.mjs
 *
 * Plain Node APIs only (fs, crypto, child_process), so it runs under the
 * Node 20 CI job; only the full tables check needs node:sqlite (Node >= 22.13).
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {execFileSync, spawnSync} from 'child_process'; // @ai
import {createHash} from 'crypto';
// @ai-start
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import os from 'os';
// @ai-end
import path from 'path';

import {
  MUSHAF_TABLES_SHA256,
  REWAYAH_DATA_MANIFEST,
  REWAYAH_DATA_MD5,
} from '../rewayahDataManifest';
import {hasNodeSqlite} from '../__fixtures__/bundledDkSqlite';
import {
  getBundledDkDbAssetFiles,
  getCurrentDbNamesByBase,
  getRewayahDataIdentity,
} from '../DigitalKhattDataService';
import {ALL_REWAYAH_IDS, hasTextData} from '@/services/rewayah/RewayahIdentity';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const ASSET_DIR = path.join(REPO_ROOT, 'data', 'mushaf', 'digitalkhatt');
const SERVICE_SOURCE = readFileSync(
  path.join(REPO_ROOT, 'services', 'mushaf', 'DigitalKhattDataService.ts'),
  'utf8',
);

function sha256(file: string): string {
  return createHash('sha256')
    .update(readFileSync(path.join(ASSET_DIR, file)))
    .digest('hex');
}

// @ai-start
function md5(file: string): string {
  return createHash('md5')
    .update(readFileSync(path.join(ASSET_DIR, file)))
    .digest('hex');
}
// @ai-end

function requiredDbAssets(source: string): string[] {
  const re =
    /require\(\s*['"]\.\.\/\.\.\/data\/mushaf\/digitalkhatt\/([^'"/\\]+\.db)['"]\s*\)/g;
  return [...new Set([...source.matchAll(re)].map(m => m[1]))].sort();
}

describe('rewayahDataManifest (contract C4)', () => {
  const manifestFiles = Object.keys(REWAYAH_DATA_MANIFEST).sort();

  it('covers exactly the DB assets DigitalKhattDataService requires', () => {
    const required = requiredDbAssets(SERVICE_SOURCE);
    expect(required.length).toBeGreaterThanOrEqual(8);
    expect(required).toContain('digital-khatt-v2.db');
    // The source of the generated page lines: never bundled.
    expect(required).not.toContain('digital-khatt-15-lines.db');
    expect(manifestFiles).toEqual(required);
    expect([...getBundledDkDbAssetFiles()].sort()).toEqual(required);
  });

  it('keys every bundled asset by its own file name', () => {
    const pairs = [
      ...SERVICE_SOURCE.matchAll(
        /'([^']+\.db)':\s*require\(\s*'\.\.\/\.\.\/data\/mushaf\/digitalkhatt\/([^']+\.db)'\s*\)/g,
      ),
    ];
    expect(pairs.length).toBe(manifestFiles.length);
    for (const [, key, file] of pairs) expect(key).toBe(file);
  });

  it.each(Object.entries(REWAYAH_DATA_MANIFEST))(
    '%s hash matches the file on disk',
    (file, hash) => {
      expect(statSync(path.join(ASSET_DIR, file)).size).toBeGreaterThan(0);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(sha256(file)).toBe(hash);
    },
  );

  // @ai-start
  it('holds the md5 of exactly the same assets, matching the files on disk', () => {
    expect(Object.keys(REWAYAH_DATA_MD5).sort()).toEqual(manifestFiles);
    for (const [file, hash] of Object.entries(REWAYAH_DATA_MD5)) {
      expect(hash).toMatch(/^[0-9a-f]{32}$/);
      expect(md5(file)).toBe(hash);
    }
  });
  // @ai-end

  it('resolves an identity and a unique on-device name for every rewayah with text', () => {
    const withText = ALL_REWAYAH_IDS.filter(hasTextData);
    expect(withText.length).toBe(8);
    for (const rewayah of withText) {
      const identity = getRewayahDataIdentity(rewayah);
      expect(identity).not.toBeNull();
      expect(identity?.wordsSha8).toMatch(/^[0-9a-f]{8}$/);
      expect(identity?.layoutSha8).toBe(MUSHAF_TABLES_SHA256.slice(0, 8));
    }
    // Throws if two assets would share an on-device base name.
    const names = getCurrentDbNamesByBase();
    expect(new Set(names.values()).size).toBe(names.size);
    expect(names.get('dk_words')).toBe(
      `dk_words.${REWAYAH_DATA_MANIFEST['digital-khatt-v2.db'].slice(0, 8)}.db`,
    );
    expect(names.has('dk_layout')).toBe(false);
  });

  it('is byte-identical to what gen-manifest.mjs generates', () => {
    // Throws (non-zero exit) when the committed manifest is stale.
    const out = execFileSync(
      process.execPath,
      [
        path.join(REPO_ROOT, 'scripts', 'rewayah', 'gen-manifest.mjs'),
        '--check',
      ],
      {cwd: REPO_ROOT, encoding: 'utf8'},
    );
    expect(out).toContain('up to date');
  });

  // @ai-start
  it('is checked before every release build, but not in development', () => {
    const {scripts} = JSON.parse(
      readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'),
    ) as {scripts: Record<string, string>};
    const check = 'node scripts/rewayah/gen-manifest.mjs --check';
    expect(scripts['check:rewayah-manifest']).toBe(check);
    // EAS runs this npm hook first on every build, in the cloud or --local.
    expect(scripts['eas-build-pre-install']).toBe(check);
    // Local iOS release archives.
    for (const name of ['ios:archive', 'ios:archive:upload']) {
      expect(scripts[name].startsWith(`${check} && `)).toBe(true);
    }
    for (const name of ['start', 'ios', 'android', 'test', 'test:ci']) {
      expect(scripts[name]).not.toContain('gen-manifest');
    }
  });

  describe('in a copy of the scripts', () => {
    let root = '';
    let assetDir = '';
    let script = '';
    beforeEach(() => {
      root = mkdtempSync(path.join(os.tmpdir(), 'gen-manifest-'));
      assetDir = path.join(root, 'data', 'mushaf', 'digitalkhatt');
      script = path.join(root, 'scripts', 'rewayah', 'gen-manifest.mjs');
      mkdirSync(assetDir, {recursive: true});
      mkdirSync(path.dirname(script), {recursive: true});
      mkdirSync(path.join(root, 'services', 'mushaf'), {recursive: true});
      copyFileSync(
        path.join(REPO_ROOT, 'scripts', 'rewayah', 'gen-manifest.mjs'),
        script,
      );
      writeFileSync(
        path.join(root, 'services', 'mushaf', 'DigitalKhattDataService.ts'),
        "const DK = {'a.db': require('../../data/mushaf/digitalkhatt/a.db')};\n",
      );
      writeFileSync(path.join(assetDir, 'a.db'), 'first version');
      writeFileSync(
        path.join(assetDir, 'digital-khatt-15-lines.db'),
        'the layout source',
      );
      writeTables('tables 1');
    });
    afterEach(() => rmSync(root, {recursive: true, force: true}));

    // What gen-mushaf-tables.mjs writes: the tables and the sha256 of each DB
    // they come from.
    function writeTables(data: string) {
      const source = (file: string) =>
        `//   ${createHash('sha256')
          .update(readFileSync(path.join(assetDir, file)))
          .digest('hex')} ${file}`;
      writeFileSync(
        path.join(root, 'services', 'mushaf', 'mushafTables.generated.ts'),
        [source('digital-khatt-15-lines.db'), source('a.db'), data, ''].join(
          '\n',
        ),
      );
    }
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [script, ...args], {
        cwd: root,
        encoding: 'utf8',
      });
    const tablesKey = () =>
      /MUSHAF_TABLES_SHA256 =\s*'([0-9a-f]{64})'/.exec(
        readFileSync(
          path.join(root, 'services', 'mushaf', 'rewayahDataManifest.ts'),
          'utf8',
        ),
      )?.[1];

    it('fails the check once the tables change without a new manifest', () => {
      expect(run().status).toBe(0);
      expect(run('--check').status).toBe(0);

      writeTables('tables 2');
      const stale = run('--check');
      expect(stale.status).toBe(1);
      expect(stale.stderr).toContain('rewayahDataManifest.ts is stale');
    });

    it.each(['digital-khatt-15-lines.db', 'a.db'])(
      'fails every run once %s changes, until the tables are generated again',
      file => {
        expect(run().status).toBe(0);
        const key = tablesKey();

        writeFileSync(path.join(assetDir, file), 'corrected version');
        for (const stale of [run(), run('--check')]) {
          expect(stale.status).toBe(1);
          expect(stale.stderr).toContain(
            `mushafTables.generated.ts is stale: ${file} changed`,
          );
        }

        writeTables('tables 2');
        expect(run().status).toBe(0);
        expect(run('--check').status).toBe(0);
        expect(tablesKey()).not.toBe(key);
      },
    );
  });
  // @ai-end
});

describe('MUSHAF_TABLES_SHA256', () => {
  const TABLES = path.join(
    REPO_ROOT,
    'services',
    'mushaf',
    'mushafTables.generated.ts',
  );

  it('is the hash of the generated tables', () => {
    expect(MUSHAF_TABLES_SHA256).toBe(
      createHash('sha256').update(readFileSync(TABLES)).digest('hex'),
    );
  });

  // The full check: the tables are what the DBs give now.
  (hasNodeSqlite() ? it : it.skip)(
    'names tables that gen-mushaf-tables.mjs generates from the DBs',
    () => {
      const result = spawnSync(
        process.execPath,
        [
          path.join(REPO_ROOT, 'scripts', 'rewayah', 'gen-mushaf-tables.mjs'),
          '--check',
        ],
        {cwd: REPO_ROOT, encoding: 'utf8'},
      );
      expect(result.stderr).not.toContain('[gen-mushaf-tables]');
      expect(result.status).toBe(0);
    },
  );
});
