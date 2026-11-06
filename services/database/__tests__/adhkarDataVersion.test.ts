// services/database/__tests__/adhkarDataVersion.test.ts
// data/adhkar.json reaches existing installs only through a reseed, and the
// reseed runs only when ADHKAR_DATA_VERSION goes up. This test fails when the
// file changes without a fingerprint recorded for the current version.
import path from 'path';
import {ADHKAR_DATA_VERSION} from '../adhkarDataVersion';
import {
  adhkarDataFingerprint,
  readFingerprints,
} from '@/scripts/adhkar-content/dataFingerprint';

const root = path.resolve(__dirname, '../../..');

describe('adhkar data version', () => {
  const fingerprints = readFingerprints(root);

  it('records the current version as the latest one', () => {
    const versions = Object.keys(fingerprints).map(Number);
    expect(Math.max(...versions)).toBe(ADHKAR_DATA_VERSION);
  });

  it('matches data/adhkar.json (after a data change: bump ADHKAR_DATA_VERSION once per release, then run npx tsx scripts/adhkar-content/write-data-fingerprint.ts)', () => {
    expect(adhkarDataFingerprint(root)).toBe(
      fingerprints[String(ADHKAR_DATA_VERSION)],
    );
  });

  it('gives every version different content', () => {
    const hashes = Object.values(fingerprints);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});
