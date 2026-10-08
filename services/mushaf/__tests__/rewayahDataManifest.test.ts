/**
 * Guards contract C4: services/mushaf/rewayahDataManifest.ts must hold the
 * sha256 of exactly the Digital Khatt DB assets DigitalKhattDataService
 * bundles. On-device copies are named from these hashes, so a stale manifest
 * would let installed apps keep reading an outdated copy of corrected text.
 *
 * Fix a failure with: node scripts/rewayah/gen-manifest.mjs
 *
 * Plain Node APIs only (fs, crypto, child_process), so it runs under the
 * Node 20 CI job.
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

import {REWAYAH_DATA_MANIFEST, REWAYAH_DATA_MD5} from '../rewayahDataManifest';
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
    expect(required.length).toBeGreaterThanOrEqual(9);
    expect(required).toContain('digital-khatt-v2.db');
    expect(required).toContain('digital-khatt-15-lines.db');
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
      expect(identity?.layoutSha8).toMatch(/^[0-9a-f]{8}$/);
    }
    // Throws if two assets would share an on-device base name.
    const names = getCurrentDbNamesByBase();
    expect(new Set(names.values()).size).toBe(names.size);
    expect(names.get('dk_words')).toBe(
      `dk_words.${REWAYAH_DATA_MANIFEST['digital-khatt-v2.db'].slice(0, 8)}.db`,
    );
    expect(names.get('dk_layout')).toBe(
      `dk_layout.${REWAYAH_DATA_MANIFEST['digital-khatt-15-lines.db'].slice(
        0,
        8,
      )}.db`,
    );
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

  it('fails the check once a bundled DB changes without a new manifest', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gen-manifest-'));
    try {
      const assetDir = path.join(root, 'data', 'mushaf', 'digitalkhatt');
      const script = path.join(root, 'scripts', 'rewayah', 'gen-manifest.mjs');
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
      const run = (...args: string[]) =>
        spawnSync(process.execPath, [script, ...args], {
          cwd: root,
          encoding: 'utf8',
        });

      expect(run().status).toBe(0);
      expect(run('--check').status).toBe(0);

      writeFileSync(path.join(assetDir, 'a.db'), 'corrected version');
      const stale = run('--check');
      expect(stale.status).toBe(1);
      expect(stale.stderr).toContain('is stale');
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });
  // @ai-end
});
