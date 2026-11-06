// scripts/adhkar-content/dataFingerprint.ts
// SHA-256 of data/adhkar.json, recorded per ADHKAR_DATA_VERSION in
// services/database/__tests__/fixtures/adhkar-data-fingerprints.json.
// No '@/' imports: tsx scripts import this file.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const ADHKAR_DATA_PATH = 'data/adhkar.json';
export const FINGERPRINTS_PATH =
  'services/database/__tests__/fixtures/adhkar-data-fingerprints.json';

export function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function readFingerprints(root: string): Record<string, string> {
  const parsed: unknown = JSON.parse(
    fs.readFileSync(path.join(root, FINGERPRINTS_PATH), 'utf8'),
  );
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${FINGERPRINTS_PATH} must be an object`);
  }
  const entries: [string, unknown][] = Object.entries(parsed);
  const out: Record<string, string> = {};
  for (const [version, hash] of entries) {
    if (typeof hash !== 'string') {
      throw new Error(`${FINGERPRINTS_PATH}: version ${version} is not a hash`);
    }
    out[version] = hash;
  }
  return out;
}

export function adhkarDataFingerprint(root: string): string {
  return sha256(fs.readFileSync(path.join(root, ADHKAR_DATA_PATH), 'utf8'));
}
