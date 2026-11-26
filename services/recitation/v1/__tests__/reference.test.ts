import fs from 'fs';
import path from 'path';
import {MODEL_REGISTRY, REFERENCE} from '@tilawa/core-v1';
import {ayahLetters, lettersOf} from '../../secondLook/ayahLetters';
import {V1_MODEL, V1_REFERENCE} from '../assets';

// Tilawa 1.0 names words by its reference, ref-v2 (Tanzil text through
// quran-transcript). The app turns its 1-based word into the engine's 0-based word,
// which every mark, the mushaf cursor and the second look share. That only holds if
// ref-v2 splits each ayah into the same words as the app's text.

interface RefAyah {
  s: number;
  a: number;
  w: string[];
}

const ROOT = path.resolve(__dirname, '../../../..');
const ref = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'node_modules/@tilawa/core-v1/assets/ref-v2.json'),
    'utf8',
  ),
) as {version: string; ayahs: RefAyah[]};
const quran = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data/quran.json'), 'utf8'),
) as Record<string, {verse_key: string; text: string}>;

/** The app's words of an ayah, as letters, with the signs that are not words left out. */
function ourWords(key: string): string[] {
  const entry = Object.values(quran).find(e => e.verse_key === key);
  if (!entry) throw new Error(`no ${key}`);
  return entry.text.split(/\s+/).map(lettersOf).filter(Boolean);
}

const ourByKey = new Map<string, string[]>();
for (const entry of Object.values(quran)) {
  ourByKey.set(
    entry.verse_key,
    entry.text.split(/\s+/).map(lettersOf).filter(Boolean),
  );
}

// Where ref-v2 (like the 0.4 engine) writes one of the text's words as two.
const SPLITS = ['15:7', '27:20', '36:22'];

describe('ref-v2 against the app text', () => {
  it('is the reference the pinned release was built against', () => {
    expect(ref.version).toBe('ref-v2');
    expect(REFERENCE.version).toBe('ref-v2');
    expect(V1_REFERENCE.bytes).toBe(REFERENCE.bytes);
  });

  it('has every ayah, in order', () => {
    expect(ref.ayahs).toHaveLength(6236);
    const inOrder = [...ref.ayahs].sort((x, y) => x.s - y.s || x.a - y.a);
    expect(ref.ayahs).toEqual(inOrder);
    expect(new Set(ref.ayahs.map(a => `${a.s}:${a.a}`)).size).toBe(6236);
    for (const a of ref.ayahs) expect(ourByKey.has(`${a.s}:${a.a}`)).toBe(true);
  });

  it('splits every ayah into the same words, except the three known splits', () => {
    const differ: string[] = [];
    for (const a of ref.ayahs) {
      const key = `${a.s}:${a.a}`;
      if (a.w.length !== ourByKey.get(key)?.length) differ.push(key);
    }
    expect(differ).toEqual(SPLITS);
    for (const key of SPLITS) {
      const refAyah = ref.ayahs.find(a => `${a.s}:${a.a}` === key);
      expect(refAyah?.w.length).toBe(ourWords(key).length + 1);
    }
  });

  it('the second look has no letters for those three, so their marks show unchecked', () => {
    for (const key of SPLITS) {
      const [surah, ayah] = key.split(':').map(Number);
      expect(ayahLetters(surah, ayah)).toBeNull();
    }
  });
});

describe('the pinned model', () => {
  it('is the full tier of the registry this release ships', () => {
    const full = MODEL_REGISTRY.tiers.find(t => t.tier === 'full');
    expect(full).toBeDefined();
    expect(full?.id).toBe('spliced-clean');
    expect(full?.version).toBe('1-int8');
    expect(V1_MODEL.bytes).toBe(full?.bytes);
    expect(V1_MODEL.sha256).toBe(full?.sha256);
    expect(V1_MODEL.url).toBe(
      'https://github.com/yazinsai/tilawa/releases/download/models-v1/spliced-clean-1-int8.onnx',
    );
  });

  it('the reference is the file the SDK would verify', () => {
    expect(V1_REFERENCE.bytes).toBe(REFERENCE.bytes);
    expect(V1_REFERENCE.sha256).toBe(REFERENCE.sha256);
  });
});
