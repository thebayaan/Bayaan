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

import {execFileSync} from 'child_process';
import {createHash} from 'crypto';
import {readFileSync, statSync} from 'fs';
import path from 'path';

import {REWAYAH_DATA_MANIFEST} from '../rewayahDataManifest';
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
});
