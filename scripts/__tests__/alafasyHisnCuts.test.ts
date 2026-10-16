// Checks the Alafasy Hisn al-Muslim manifest against data/adhkar.json and the
// bundled audio map: a category is Alafasy only if every row in it is.
import fs from 'fs';
import path from 'path';
import adhkarData from '@/data/adhkar.json';
import manifestJson from '../adhkar-content/alafasy-hisn-cuts.json';

interface ManifestEntry {
  row: number;
  category: number;
  file: string;
  source: string;
  start: number;
  end: number;
  f1: number;
  note: string;
}

const root = path.resolve(__dirname, '../..');
const manifest: ManifestEntry[] = manifestJson;

function mappedKeys(): Set<string> {
  const source = fs.readFileSync(
    path.join(root, 'utils/adhkarAudio.ts'),
    'utf8',
  );
  return new Set(
    [...source.matchAll(/'([^']+\.mp3)': require\(/g)].map(m => m[1]),
  );
}

describe('alafasy hisn cuts manifest', () => {
  const rowIds = new Set(manifest.map(e => String(e.row)));

  it('has unique rows whose category and file match the data', () => {
    expect(rowIds.size).toBe(manifest.length);
    for (const entry of manifest) {
      const row = adhkarData.adhkar.find(r => r.id === String(entry.row));
      expect(row?.category_id).toBe(String(entry.category));
      expect(row?.audio_file).toBe(entry.file);
    }
  });

  it('covers every row of every category it names', () => {
    const categories = new Set(manifest.map(e => String(e.category)));
    for (const category of categories) {
      const missing = adhkarData.adhkar
        .filter(r => r.category_id === category && !rowIds.has(r.id))
        .map(r => r.id);
      expect(missing).toEqual([]);
    }
  });

  it('has every file in the asset map and on disk', () => {
    const keys = mappedKeys();
    for (const entry of manifest) {
      expect(keys.has(entry.file)).toBe(true);
      expect(
        fs.existsSync(path.join(root, 'assets/audio/adhkar', entry.file)),
      ).toBe(true);
    }
  });

  it('never touches the morning/evening lists or the quranic category', () => {
    const listed = new Set(
      Object.values(adhkarData.super_category_dhikr_ids).flat(),
    );
    for (const entry of manifest) {
      const id = String(entry.row);
      expect(listed.has(id)).toBe(false);
      const row = adhkarData.adhkar.find(r => r.id === id);
      expect(row?.category_id).not.toBe('quranic-duas');
      expect(row?.category_id).not.toBe('27');
    }
  });
});
