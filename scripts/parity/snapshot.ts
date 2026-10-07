import fs from 'fs';

// QF terms allow no caching beyond a week.
export const MAX_SNAPSHOT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Throws unless the snapshot file exists and was written within the last
// 7 days. Parity tests must call this before reading .parity/ snapshots.
export function assertSnapshotFresh(
  file: string,
  now: number = Date.now(),
): void {
  if (!fs.existsSync(file)) {
    throw new Error(`No parity snapshot at ${file}: run fetch-qf-snapshot.ts`);
  }
  const age = now - fs.statSync(file).mtimeMs;
  if (age > MAX_SNAPSHOT_AGE_MS) {
    throw new Error(
      `Parity snapshot ${file} is older than 7 days: delete it and re-fetch`,
    );
  }
}
