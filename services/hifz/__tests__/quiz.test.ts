import {makeQuestion, type QuizData} from '../quiz';

/** A deterministic random source (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Surah 1 (7 ayat) on page 1, surah 2 (16 ayat) on pages 2-3, surah 3 on 4.
const PAGES: Record<number, string[]> = {
  1: ['1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7'],
  2: ['2:1', '2:2', '2:3', '2:4', '2:5'],
  3: Array.from({length: 11}, (_, i) => `2:${i + 6}`),
  4: ['3:1', '3:2', '3:3'],
};
const DATA: QuizData = {
  ayahCount: surah => ({1: 7, 2: 16, 3: 3})[surah] ?? 0,
  pagesOfSurah: surah => ({1: [1], 2: [2, 3], 3: [4]})[surah] ?? [],
  keysOfPage: page => PAGES[page] ?? [],
};

const SEEDS = Array.from({length: 40}, (_, i) => i + 1);

describe('makeQuestion', () => {
  it('next never crosses into another surah', () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('next', [1], seeded(seed), DATA)!;
      const [surah, ayah] = q.prompt.verseKey.split(':').map(Number);
      expect(surah).toBe(1);
      expect(ayah).toBeLessThan(7);
      expect(q.target.expected).toEqual({
        surah: 1,
        ayah: ayah + 1,
        ayahEnd: ayah + 1,
      });
      expect(q.answer).toBe(`1:${ayah + 1}`);
    }
  });

  it('questions come only from memorised surahs', () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('continue', [2], seeded(seed), DATA)!;
      expect(q.prompt.verseKey.startsWith('2:')).toBe(true);
    }
  });

  it('continue asks for the ayah and the next two, never past the surah end', () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('continue', [3], seeded(seed), DATA)!;
      const ayah = Number(q.prompt.verseKey.split(':')[1]);
      expect(q.prompt.words).toBe(3);
      expect(q.target.expected).toEqual({
        surah: 3,
        ayah,
        ayahEnd: Math.min(ayah + 2, 3),
      });
    }
  });

  it('which surah accepts the opening of the prompt surah in tracking mode', () => {
    const q = makeQuestion('whichSurah', [2], seeded(7), DATA)!;
    expect(q.target).toMatchObject({
      mode: 'tracking',
      expected: null,
      accept: ['2:1', '2:2'],
    });
    expect(Number(q.prompt.verseKey.split(':')[1])).toBeGreaterThan(1);
    expect(q.answer).toBe('2:1');
  });

  it("bridge targets the next page's first ayah", () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('bridge', [1, 2], seeded(seed), DATA)!;
      expect(q.kind).toBe('bridge');
      expect([
        ['1:7', '2:1'],
        ['2:5', '2:6'],
      ]).toContainEqual([q.prompt.verseKey, q.answer]);
      const [surah, ayah] = q.answer.split(':').map(Number);
      expect(q.target.expected).toEqual({surah, ayah, ayahEnd: ayah});
    }
  });

  it('the same seed gives the same question', () => {
    expect(makeQuestion('next', [1, 2, 3], seeded(42), DATA)).toEqual(
      makeQuestion('next', [1, 2, 3], seeded(42), DATA),
    );
  });

  it('nothing memorised gives no question', () => {
    expect(makeQuestion('next', [], seeded(1), DATA)).toBeNull();
  });
});
