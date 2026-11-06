// Every bundled adhkar clip is referenced by a row or a list override, and
// every referenced clip is bundled.
import fs from 'fs';
import path from 'path';
import adhkarSeed from '@/data/adhkar.json';

const root = path.resolve(__dirname, '../../..');
const AUDIO_DIR = 'assets/audio/adhkar';

// Parsed from the source so the test needs no asset transform.
function mappedFiles(): Map<string, string> {
  const source = fs.readFileSync(
    path.join(root, 'utils/adhkarAudio.ts'),
    'utf8',
  );
  const entries = [
    ...source.matchAll(
      /'([^']+\.mp3)': require\(\s*'@\/assets\/audio\/adhkar\/([^']+)',?\s*\)/g,
    ),
  ];
  return new Map(entries.map(m => [m[1], m[2]]));
}

function rowFile(id: string): string | null {
  const found = adhkarSeed.adhkar.find(r => r.id === id);
  if (!found) throw new Error(`missing dhikr ${id}`);
  return found.audio_file;
}

describe('adhkar audio assets', () => {
  const map = mappedFiles();
  const overrideFiles = Object.values(
    adhkarSeed.super_category_audio_overrides,
  ).flatMap(files => Object.values(files));
  const referenced = new Set([
    ...adhkarSeed.adhkar.flatMap(r => (r.audio_file ? [r.audio_file] : [])),
    ...overrideFiles,
  ]);

  it('maps every key to the file of the same name, which exists', () => {
    expect(map.size).toBeGreaterThan(0);
    for (const [key, file] of map) {
      expect(file).toBe(key);
      expect(fs.existsSync(path.join(root, AUDIO_DIR, file))).toBe(true);
    }
  });

  it('bundles exactly the clips that rows and list overrides reference', () => {
    expect([...map.keys()].sort()).toEqual([...referenced].sort());
  });

  it('ships no unmapped mp3 in the asset folder', () => {
    const onDisk = fs
      .readdirSync(path.join(root, AUDIO_DIR))
      .filter(f => f.endsWith('.mp3'));
    expect(onDisk.sort()).toEqual([...map.keys()].sort());
  });

  it('has audio for the six evening rows and rows 72 and 149', () => {
    const ids = [
      'evening-77',
      'evening-78',
      'evening-80',
      'evening-81',
      'evening-89',
      'evening-90',
      '72',
      '149',
    ];
    for (const id of ids) {
      const file = rowFile(id);
      expect({id, mapped: file !== null && map.has(file)}).toEqual({
        id,
        mapped: true,
      });
    }
  });

  it('gives each Quranic dua its own clip', () => {
    const files = Array.from({length: 40}, (_, i) =>
      rowFile(`quranic-${i + 1}`),
    );
    expect(files.every(f => f !== null && map.has(f))).toBe(true);
    expect(new Set(files).size).toBe(40);
  });
});
