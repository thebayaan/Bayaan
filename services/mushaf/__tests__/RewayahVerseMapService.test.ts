/**
 * RewayahVerseMapService: contract-C3 verse maps between a rewayah's own
 * verse numbering and Hafs verse keys.
 *
 * Part 1 drives the service with tiny hand-written maps (format handling,
 * identity omission, empty inverse lists, fail-closed validation).
 * Part 2 checks the bundled data/mushaf/digitalkhatt/<id>-versemap.json files:
 * structure, totals per counting system, inverse consistency, and the
 * counting-system facts the audio follow-along relies on.
 */

import {
  parseVerseMap,
  RewayahVerseMapService,
  rewayahVerseMapService,
  VERSE_MAP_FILE_IDS,
  type RewayahVerseMapJson,
  type VerseMapFileId,
  type VerseMapLoader,
} from '../RewayahVerseMapService';
import {SURAHS} from '@/data/surahData';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

const HAFS_COUNTS: Record<string, number> = Object.fromEntries(
  SURAHS.map(s => [String(s.id), s.verses_count]),
);

/** A Warsh-like map: surah 2 has 285 verses, Warsh 2:1 = Hafs 2:1 + 2:2. */
function tinyWarshMap(): RewayahVerseMapJson {
  const r2h: Record<string, string[]> = {'1:1': ['1:2']};
  const h2r: Record<string, string[]> = {'1:1': [], '1:2': ['1:1']};
  r2h['2:1'] = ['2:1', '2:2'];
  h2r['2:2'] = ['2:1'];
  for (let a = 2; a <= 285; a++) {
    r2h[`2:${a}`] = [`2:${a + 1}`];
    h2r[`2:${a + 1}`] = [`2:${a}`];
  }
  return {
    __format: 1,
    rewayah: 'warsh',
    verseCounts: {...HAFS_COUNTS, '2': 285},
    r2h,
    h2r,
  };
}

function serviceWith(
  overrides: Partial<Record<VerseMapFileId, () => unknown>>,
): RewayahVerseMapService {
  const missing: VerseMapLoader = () => {
    throw new Error('not provided');
  };
  const loaders = {
    warsh: missing,
    qaloon: missing,
    bazzi: missing,
    qumbul: missing,
    doori: missing,
    soosi: missing,
    shouba: missing,
    ...overrides,
  } as Record<VerseMapFileId, VerseMapLoader>;
  return new RewayahVerseMapService(loaders);
}

describe('RewayahVerseMapService with small fixture maps', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());

  it('maps listed keys and treats omitted keys as identity', () => {
    const svc = serviceWith({warsh: tinyWarshMap});
    expect(svc.hasVerseMap('warsh')).toBe(true);
    expect(svc.toHafsKeys('warsh', '2:1')).toEqual(['2:1', '2:2']);
    expect(svc.toHafsKeys('warsh', '2:4')).toEqual(['2:5']);
    expect(svc.toHafsKeys('warsh', '3:7')).toEqual(['3:7']); // omitted
    expect(svc.toRiwayahKeys('warsh', '2:2')).toEqual(['2:1']);
    expect(svc.toRiwayahKeys('warsh', '2:1')).toEqual(['2:1']); // omitted
    expect(svc.toRiwayahKeys('warsh', '2:286')).toEqual(['2:285']);
  });

  it('returns an empty list for a Hafs verse that belongs to no rewayah verse', () => {
    const svc = serviceWith({warsh: tinyWarshMap});
    expect(svc.toRiwayahKeys('warsh', '1:1')).toEqual([]);
    expect(svc.toHafsKeys('warsh', '1:1')).toEqual(['1:2']);
  });

  it('rejects keys outside the counts instead of inventing verses', () => {
    const svc = serviceWith({warsh: tinyWarshMap});
    expect(svc.toHafsKeys('warsh', '2:286')).toEqual([]); // Warsh has 285
    expect(svc.toRiwayahKeys('warsh', '2:287')).toEqual([]); // Hafs has 286
    expect(svc.toHafsKeys('warsh', '2:0')).toEqual([]);
    expect(svc.toHafsKeys('warsh', 'nonsense')).toEqual([]);
    expect(svc.verseCount('warsh', 2)).toBe(285);
    expect(svc.verseCount('warsh', 115)).toBeNull();
  });

  it('reports identity surahs', () => {
    const svc = serviceWith({warsh: tinyWarshMap});
    expect(svc.isIdentitySurah('warsh', 2)).toBe(false);
    expect(svc.isIdentitySurah('warsh', 1)).toBe(false);
    expect(svc.isIdentitySurah('warsh', 3)).toBe(true);
  });

  it('treats Hafs as the identity map without any file', () => {
    const svc = serviceWith({});
    expect(svc.hasVerseMap('hafs')).toBe(true);
    expect(svc.toHafsKeys('hafs', '2:286')).toEqual(['2:286']);
    expect(svc.toHafsKeys('hafs', '2:287')).toEqual([]);
    expect(svc.toRiwayahKeys('hafs', '112:4')).toEqual(['112:4']);
    expect(svc.verseCount('hafs', 2)).toBe(286);
    expect(svc.isIdentitySurah('hafs', 9)).toBe(true);
  });

  it('has no numbering for rewayat without a bundled map', () => {
    const svc = serviceWith({});
    expect(svc.expectsVerseMap('hisham' as RewayahId)).toBe(false);
    expect(svc.hasVerseMap('hisham' as RewayahId)).toBe(false);
    expect(svc.verseCount('hisham' as RewayahId, 2)).toBeNull();
    expect(svc.toHafsKeys('hisham' as RewayahId, '2:1')).toEqual([]);
    expect(svc.toRiwayahKeys('hisham' as RewayahId, '2:1')).toEqual([]);
    expect(svc.isIdentitySurah('hisham' as RewayahId, 2)).toBeNull();
  });

  it.each([
    ['wrong format', (m: RewayahVerseMapJson) => ({...m, __format: 2})],
    ['wrong rewayah', (m: RewayahVerseMapJson) => ({...m, rewayah: 'qaloon'})],
    [
      'missing surah count',
      (m: RewayahVerseMapJson) => {
        const verseCounts = {...m.verseCounts};
        delete verseCounts['114'];
        return {...m, verseCounts};
      },
    ],
    [
      'r2h value outside the Hafs count',
      (m: RewayahVerseMapJson) => ({...m, r2h: {...m.r2h, '2:285': ['2:287']}}),
    ],
    [
      'r2h key beyond the rewayah count',
      (m: RewayahVerseMapJson) => ({...m, r2h: {...m.r2h, '2:286': ['2:286']}}),
    ],
    [
      'empty r2h list',
      (m: RewayahVerseMapJson) => ({...m, r2h: {...m.r2h, '2:5': []}}),
    ],
    [
      'cross-surah mapping',
      (m: RewayahVerseMapJson) => ({...m, h2r: {...m.h2r, '3:1': ['2:1']}}),
    ],
    ['not an object', () => 'garbage'],
  ])('fails closed on a malformed map (%s)', (_label, mutate) => {
    const svc = serviceWith({warsh: () => mutate(tinyWarshMap())});
    expect(svc.expectsVerseMap('warsh')).toBe(true);
    expect(svc.hasVerseMap('warsh')).toBe(false);
    expect(svc.toHafsKeys('warsh', '2:1')).toEqual([]);
    expect(svc.toRiwayahKeys('warsh', '2:1')).toEqual([]);
    expect(svc.verseCount('warsh', 2)).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('loads each map once', () => {
    const loader = jest.fn(tinyWarshMap);
    const svc = serviceWith({warsh: loader});
    svc.toHafsKeys('warsh', '2:1');
    svc.toRiwayahKeys('warsh', '2:2');
    svc.verseCount('warsh', 2);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

// ── Bundled maps ────────────────────────────────────────────────────────────

const FILE_IDS = Object.entries(VERSE_MAP_FILE_IDS) as [
  RewayahId,
  VerseMapFileId,
][];

function loadBundled(fileId: VerseMapFileId): RewayahVerseMapJson {
  return require(`../../../data/mushaf/digitalkhatt/${fileId}-versemap.json`);
}

const EXPECTED_TOTALS: Record<VerseMapFileId, number> = {
  warsh: 6214, // Madani count
  qaloon: 6214,
  bazzi: 6220, // Makki count
  qumbul: 6220,
  doori: 6217, // KFGQPC al-Duri / al-Susi count
  soosi: 6217,
  shouba: 6236, // Kufi count = Hafs
};

describe('bundled contract-C3 verse maps', () => {
  it.each(FILE_IDS)('%s map is valid and loads', (rewayah, fileId) => {
    const raw = loadBundled(fileId);
    expect(raw.__format).toBe(1);
    expect(raw.rewayah).toBe(fileId);
    expect(() => parseVerseMap(raw, fileId)).not.toThrow();
    expect(rewayahVerseMapService.hasVerseMap(rewayah)).toBe(true);
    const total = Object.values(raw.verseCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(EXPECTED_TOTALS[fileId]);
  });

  it.each(FILE_IDS)(
    '%s r2h and h2r are inverse, ordered and complete',
    rewayah => {
      const svc = rewayahVerseMapService;
      const order = (k: string) => {
        const [s, a] = k.split(':').map(Number);
        return s * 1000 + a;
      };
      for (let s = 1; s <= 114; s++) {
        const n = svc.verseCount(rewayah, s)!;
        let lastHafs = 0;
        for (let a = 1; a <= n; a++) {
          const rKey = `${s}:${a}`;
          const hafs = svc.toHafsKeys(rewayah, rKey);
          expect(hafs.length).toBeGreaterThan(0);
          // monotone: never earlier than the previous verse's last Hafs verse
          expect(order(hafs[0])).toBeGreaterThanOrEqual(lastHafs);
          lastHafs = order(hafs[hafs.length - 1]);
          for (const h of hafs) {
            expect(svc.toRiwayahKeys(rewayah, h)).toContain(rKey);
          }
        }
        for (let h = 1; h <= SURAHS[s - 1].verses_count; h++) {
          for (const r of svc.toRiwayahKeys(rewayah, `${s}:${h}`)) {
            expect(svc.toHafsKeys(rewayah, r)).toContain(`${s}:${h}`);
          }
        }
      }
    },
  );

  it('Shubah (Kufi count) is the identity map', () => {
    const raw = loadBundled('shouba');
    expect(raw.r2h).toEqual({});
    expect(raw.h2r).toEqual({});
    expect(raw.verseCounts).toEqual(HAFS_COUNTS);
  });

  it('Madani count facts (Warsh, Qalun)', () => {
    for (const rewayah of ['warsh', 'qalun'] as RewayahId[]) {
      const svc = rewayahVerseMapService;
      // al-Fatihah: basmala is not a verse; Hafs 1:7 is two verses
      expect(svc.toHafsKeys(rewayah, '1:1')).toEqual(['1:2']);
      expect(svc.toRiwayahKeys(rewayah, '1:1')).toEqual([]);
      expect(svc.toRiwayahKeys(rewayah, '1:7')).toEqual(['1:6', '1:7']);
      // al-Baqarah: alif-lam-mim is part of verse 1
      expect(svc.toHafsKeys(rewayah, '2:1')).toEqual(['2:1', '2:2']);
      expect(svc.toHafsKeys(rewayah, '2:4')).toEqual(['2:5']);
      expect(svc.toRiwayahKeys(rewayah, '2:5')).toEqual(['2:4']);
      // Ayat al-Kursi is two verses
      expect(svc.toRiwayahKeys(rewayah, '2:255')).toEqual(['2:253', '2:254']);
      expect(svc.toRiwayahKeys(rewayah, '2:286')).toEqual(['2:285']);
      expect(svc.verseCount(rewayah, 2)).toBe(285);
      expect(svc.verseCount(rewayah, 5)).toBe(122);
    }
  });

  it('Makki count facts (al-Bazzi, Qunbul)', () => {
    for (const rewayah of ['al-bazzi', 'qunbul'] as RewayahId[]) {
      const svc = rewayahVerseMapService;
      expect(svc.verseCount(rewayah, 112)).toBe(5);
      expect(svc.toHafsKeys(rewayah, '112:3')).toEqual(['112:3']);
      expect(svc.toHafsKeys(rewayah, '112:4')).toEqual(['112:3']);
      expect(svc.toHafsKeys(rewayah, '112:5')).toEqual(['112:4']);
      expect(svc.toRiwayahKeys(rewayah, '112:3')).toEqual(['112:3', '112:4']);
      expect(svc.isIdentitySurah(rewayah, 1)).toBe(true); // basmala counted
    }
  });

  it('al-Duri / al-Susi count facts', () => {
    for (const rewayah of ['al-duri-abi-amr', 'al-susi'] as RewayahId[]) {
      const svc = rewayahVerseMapService;
      expect(svc.verseCount(rewayah, 67)).toBe(30);
      expect(svc.toRiwayahKeys(rewayah, '1:1')).toEqual([]);
      expect(svc.verseCount(rewayah, 2)).toBe(285);
    }
  });
});
