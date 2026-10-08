import fs from 'fs';
import os from 'os';
import path from 'path';
import {MAX_SNAPSHOT_AGE_MS, assertSnapshotFresh} from '../snapshot';

function tempSnapshot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-'));
  const file = path.join(dir, 'tafsir-169.json');
  fs.writeFileSync(file, '{"records":[]}');
  return file;
}

describe('assertSnapshotFresh', () => {
  it('accepts a snapshot written within 7 days', () => {
    const file = tempSnapshot();
    const mtime = fs.statSync(file).mtimeMs;
    expect(() =>
      assertSnapshotFresh(file, mtime + MAX_SNAPSHOT_AGE_MS - 1000),
    ).not.toThrow();
  });

  it('refuses a snapshot older than 7 days', () => {
    const file = tempSnapshot();
    const mtime = fs.statSync(file).mtimeMs;
    expect(() =>
      assertSnapshotFresh(file, mtime + MAX_SNAPSHOT_AGE_MS + 1000),
    ).toThrow('older than 7 days');
  });

  it('refuses a missing snapshot', () => {
    expect(() => assertSnapshotFresh('/nonexistent/tafsir-169.json')).toThrow(
      'No parity snapshot',
    );
  });
});
