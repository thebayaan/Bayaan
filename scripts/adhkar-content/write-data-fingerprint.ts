// scripts/adhkar-content/write-data-fingerprint.ts
// Records the SHA-256 of data/adhkar.json for the current ADHKAR_DATA_VERSION.
// Bump ADHKAR_DATA_VERSION once per release that changes the data, then run:
//   npx tsx scripts/adhkar-content/write-data-fingerprint.ts
import fs from 'fs';
import path from 'path';
import {ADHKAR_DATA_VERSION} from '../../services/database/adhkarDataVersion';
import {
  FINGERPRINTS_PATH,
  adhkarDataFingerprint,
  readFingerprints,
} from './dataFingerprint';

const root = path.resolve(__dirname, '../..');

function main(): void {
  const fingerprints = readFingerprints(root);
  const hash = adhkarDataFingerprint(root);
  const current = String(ADHKAR_DATA_VERSION);
  for (const [version, existing] of Object.entries(fingerprints)) {
    if (version !== current && existing === hash) {
      throw new Error(
        `data/adhkar.json is unchanged since version ${version}; do not bump without a data change`,
      );
    }
  }
  const next = {...fingerprints, [current]: hash};
  fs.writeFileSync(
    path.join(root, FINGERPRINTS_PATH),
    `${JSON.stringify(next, null, 2)}\n`,
  );
  console.log(`[adhkar] version ${current} fingerprint ${hash}`);
}

main();
