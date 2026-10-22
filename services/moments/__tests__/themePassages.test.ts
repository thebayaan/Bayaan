// @ai-start
import {
  chooseSpanEnd,
  getBundledThemesBySurah,
  groupThemesBySurah,
  themeCandidatesForReciter,
  themeEndsFrom,
  themePassageId,
  ThemeRange,
} from '../themePassages';
import {MOMENT_PASSAGES} from '../passages';
import type {AyahTimestamp} from '@/types/timestamps';

/** Ayat 1..n of a surah with the given lengths in seconds. */
function timestamps(surah: number, lengthsSec: number[]): AyahTimestamp[] {
  let t = 0;
  return lengthsSec.map((len, i) => {
    const from = t;
    t += len * 1000;
    return {
      surahNumber: surah,
      ayahNumber: i + 1,
      timestampFrom: from,
      timestampTo: t,
      durationMs: len * 1000,
    };
  });
}

const themes: ThemeRange[] = [
  {surah: 50, ayahFrom: 6, ayahTo: 8},
  {surah: 50, ayahFrom: 1, ayahTo: 5},
  {surah: 50, ayahFrom: 9, ayahTo: 9},
  // A gap: 10 is missing, so 11-12 does not continue 9.
  {surah: 50, ayahFrom: 11, ayahTo: 12},
  {surah: 51, ayahFrom: 1, ayahTo: 3},
];

describe('groupThemesBySurah', () => {
  it('groups by surah in ayah order', () => {
    const grouped = groupThemesBySurah(themes);
    expect([...grouped.keys()]).toEqual([50, 51]);
    expect(grouped.get(50)!.map(t => t.ayahFrom)).toEqual([1, 6, 9, 11]);
  });

  it('covers the bundled QUL passages: 114 surahs, contiguous from ayah 1', () => {
    const bundled = getBundledThemesBySurah();
    expect(bundled.size).toBe(114);
    let count = 0;
    for (const list of bundled.values()) {
      count += list.length;
      expect(list[0].ayahFrom).toBe(1);
      for (let i = 1; i < list.length; i++) {
        expect(list[i].ayahFrom).toBe(list[i - 1].ayahTo + 1);
      }
    }
    expect(count).toBe(1051);
  });
});

describe('themeEndsFrom', () => {
  const surah50 = groupThemesBySurah(themes).get(50)!;

  it('lists this theme and the consecutive ones after it', () => {
    expect(themeEndsFrom(surah50, 0)).toEqual([5, 8, 9]);
    expect(themeEndsFrom(surah50, 1)).toEqual([8, 9]);
    expect(themeEndsFrom(surah50, 3)).toEqual([12]);
  });

  it('stops at the theme limit', () => {
    expect(themeEndsFrom(surah50, 0, 2)).toEqual([5, 8]);
  });
});

describe('chooseSpanEnd', () => {
  it('stops at the first theme end inside 20-45 s', () => {
    // Ends after ayah 2 (10 s), 4 (30 s), 6 (50 s).
    const ts = timestamps(1, [5, 5, 10, 10, 10, 10]);
    expect(chooseSpanEnd(1, 1, [2, 4, 6], ts)).toBe(4);
  });

  it('takes a single long theme when it is already in the window', () => {
    const ts = timestamps(1, [15, 15, 10]);
    expect(chooseSpanEnd(1, 1, [2, 3], ts)).toBe(2);
  });

  it('picks the closest end when none lands in the window', () => {
    // 12 s, then 52 s: 12 s is 8 s short, 52 s is 7 s over.
    const ts = timestamps(1, [12, 40]);
    expect(chooseSpanEnd(1, 1, [1, 2], ts)).toBe(2);
    // 15 s, then 60 s: 5 s short beats 15 s over.
    expect(chooseSpanEnd(1, 1, [1, 2], timestamps(1, [15, 45]))).toBe(1);
  });

  it('keeps extending a short passage while it is still too short', () => {
    const ts = timestamps(1, [4, 4, 4, 4]);
    expect(chooseSpanEnd(1, 1, [1, 2, 3, 4], ts)).toBe(4);
  });

  it('never goes past 90 s', () => {
    expect(chooseSpanEnd(1, 1, [1], timestamps(1, [95]))).toBeNull();
    // 10 s, then 100 s: only the short one is allowed.
    expect(chooseSpanEnd(1, 1, [1, 2], timestamps(1, [10, 90]))).toBe(1);
  });

  it('does not run past missing timing', () => {
    const ts = timestamps(1, [5, 5, 30]).filter(t => t.ayahNumber !== 3);
    expect(chooseSpanEnd(1, 1, [2, 3], ts)).toBe(2);
    expect(chooseSpanEnd(1, 3, [3], ts)).toBeNull();
  });

  it('measures from the start ayah, not the surah start', () => {
    const ts = timestamps(1, [60, 25, 5]);
    expect(chooseSpanEnd(1, 2, [2, 3], ts)).toBe(2);
  });
});

describe('themeCandidatesForReciter', () => {
  const grouped = getBundledThemesBySurah();

  it('only uses timed surahs and skips themes that overlap curated passages', () => {
    const candidates = themeCandidatesForReciter(
      'r1',
      'rw1',
      [1, 2, 112],
      grouped,
      MOMENT_PASSAGES,
      {seed: 1, perReciter: 10_000},
    );
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect([1, 2, 112]).toContain(c.passage.surah);
      expect(c.passage.id).toBe(
        themePassageId(c.passage.surah, c.passage.fromAyah),
      );
      expect(c.weight).toBeLessThan(1);
      expect(c.themeEnds![0]).toBe(c.passage.toAyah);
      for (const p of MOMENT_PASSAGES) {
        if (p.surah !== c.passage.surah) continue;
        const overlap =
          c.passage.fromAyah <= p.toAyah && p.fromAyah <= c.passage.toAyah;
        expect(overlap).toBe(false);
      }
    }
    // Al-Fatihah and Al-Ikhlas are single curated themes.
    expect(candidates.some(c => c.passage.surah === 1)).toBe(false);
    expect(candidates.some(c => c.passage.surah === 112)).toBe(false);
    // Ayat al-Kursi's theme is curated; the theme after it is not.
    expect(candidates.some(c => c.passage.id === 'theme:2:255')).toBe(false);
  });

  it('samples a stable subset per reciter and seed', () => {
    const surahs = Array.from({length: 114}, (_, i) => i + 1);
    const pick = (reciter: string, seed: number) =>
      themeCandidatesForReciter(reciter, 'rw', surahs, grouped, [], {
        seed,
        perReciter: 12,
      }).map(c => c.passage.id);
    expect(pick('r1', 5)).toHaveLength(12);
    expect(new Set(pick('r1', 5)).size).toBe(12);
    expect(pick('r1', 5)).toEqual(pick('r1', 5));
    expect(pick('r1', 5)).not.toEqual(pick('r2', 5));
  });
});
// @ai-end
