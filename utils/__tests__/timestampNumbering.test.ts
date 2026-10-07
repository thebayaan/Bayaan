/**
 * Pure numbering logic for ayah timing sets: per-surah decision, set-level
 * vote, translation between timing entries and Hafs verse keys, labels.
 * Uses the bundled verse maps and real timing fixtures.
 */

import {rewayahVerseMapService} from '@/services/mushaf/RewayahVerseMapService';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {AyahTimestamp} from '@/types/timestamps';
import {
  loadTimings,
  oracleHafsAyahs,
} from '@/services/timestamps/__fixtures__/timingFixtures';
import {
  classifyTimingSet,
  createTimingNumbering,
  decideSurahNumbering,
  formatPlaybackVerseLabel,
  formatVerseKeyRange,
  getRegisteredTimingNumbering,
  getTimingEntryStats,
  getTrackedVerseKeys,
  parseVerseKeyListId,
  registerTimingNumbering,
  selectTrackedVerseKeysId,
  verseKeyListId,
  type TimingNumberingMode,
  type TimingSetClass,
} from '../timestampNumbering';

const verseMap = rewayahVerseMapService;

function timings(set: string, surah: number): AyahTimestamp[] {
  const t = loadTimings(set, surah);
  if (!t) throw new Error(`missing fixture ${set}/${surah}`);
  return t;
}

function synthetic(surah: number, ayahs: number[]): AyahTimestamp[] {
  return ayahs.map((a, i) => ({
    surahNumber: surah,
    ayahNumber: a,
    timestampFrom: i * 1000,
    timestampTo: (i + 1) * 1000,
    durationMs: 1000,
  }));
}

const range = (n: number, from = 1) =>
  Array.from({length: n}, (_, i) => i + from);

function decide(
  reciterRewayah: RewayahId | null,
  surah: number,
  entries: AyahTimestamp[],
  setClass: TimingSetClass | null = null,
) {
  return decideSurahNumbering(
    {reciterRewayah, surah, entries, setClass},
    verseMap,
  );
}

function numbering(
  mode: TimingNumberingMode,
  reciterRewayah: RewayahId | null,
  surah: number,
  entries: AyahTimestamp[],
) {
  return createTimingNumbering({
    surah,
    mode,
    reciterRewayah,
    reason: 'test',
    entries,
    verseMap,
  });
}

describe('getTimingEntryStats', () => {
  it('counts entries 1..n and ignores a leading ayah-0 pre-roll', () => {
    expect(getTimingEntryStats(synthetic(112, [1, 2, 3, 4]))).toEqual({
      count: 4,
      contiguous: true,
    });
    expect(getTimingEntryStats(synthetic(112, [0, 1, 2, 3, 4]))).toEqual({
      count: 4,
      contiguous: true,
    });
  });

  it('flags gaps, duplicates and empty sets', () => {
    expect(getTimingEntryStats(synthetic(1, [1, 2, 4])).contiguous).toBe(false);
    expect(getTimingEntryStats(synthetic(1, [1, 2, 2, 3])).contiguous).toBe(
      false,
    );
    expect(getTimingEntryStats(synthetic(1, [1, 0, 2])).contiguous).toBe(false);
    expect(getTimingEntryStats([]).contiguous).toBe(false);
  });
});

describe('decideSurahNumbering', () => {
  it('keeps Hafs recitations on the identity mapping whatever the entries look like', () => {
    expect(decide('hafs', 2, timings('hafs-clean', 2)).mode).toBe('hafs');
    expect(decide('hafs', 112, timings('hafs-preroll', 112)).mode).toBe('hafs');
    expect(decide('hafs', 2, synthetic(2, [1, 2, 9])).mode).toBe('hafs');
  });

  it('rewayah count != Hafs count: decides from the surah itself', () => {
    // Warsh 14 al-Baqarah: 285 entries = Madani count
    expect(decide('warsh', 2, timings('warsh-14', 2)).mode).toBe('riwayah');
    // Warsh 134 al-Baqarah: 286 entries = Hafs count
    expect(decide('warsh', 2, timings('warsh-134', 2)).mode).toBe('hafs');
    // al-Bazzi 296 al-Ikhlas: 5 entries = Makki count
    expect(decide('al-bazzi', 112, timings('bazzi-296', 112)).mode).toBe(
      'riwayah',
    );
  });

  it('a count that matches neither system disables the surah (al-Duri 269 al-Mulk)', () => {
    const d = decide('al-duri-abi-amr', 67, timings('doori-269', 67));
    expect(d.mode).toBe('disabled');
    expect(d.needsSetClass).toBe(false);
  });

  it('equal counts with identical boundaries need no set class', () => {
    const d = decide('warsh', 112, timings('warsh-14', 112));
    expect(d).toMatchObject({mode: 'hafs', needsSetClass: false});
  });

  it('equal counts with different boundaries follow the set class', () => {
    const entries = timings('warsh-14', 1); // al-Fatihah: 7 in both counts
    expect(decide('warsh', 1, entries)).toMatchObject({
      mode: 'disabled',
      needsSetClass: true,
    });
    expect(decide('warsh', 1, entries, 'riwayah').mode).toBe('riwayah');
    expect(decide('warsh', 1, entries, 'hafs').mode).toBe('hafs');
    expect(decide('warsh', 1, entries, 'unknown')).toMatchObject({
      mode: 'disabled',
      needsSetClass: false,
    });
  });

  it('Shubah (identity map) is identity wherever the count matches', () => {
    expect(decide('shubah', 2, timings('shubah-305', 2)).mode).toBe('hafs');
    expect(decide('shubah', 2, synthetic(2, range(285))).mode).toBe('disabled');
  });

  it('entries not numbered 1..n disable a non-Hafs surah', () => {
    expect(decide('warsh', 112, synthetic(112, [1, 2, 4])).mode).toBe(
      'disabled',
    );
  });

  it('unknown rewayat: Hafs count -> identity, anything else -> disabled', () => {
    expect(decide(null, 2, synthetic(2, range(286))).mode).toBe('hafs');
    expect(decide(null, 2, synthetic(2, range(285))).mode).toBe('disabled');
    const hisham = 'hisham' as RewayahId;
    expect(decide(hisham, 2, synthetic(2, range(286))).mode).toBe('hafs');
    expect(decide(hisham, 2, synthetic(2, range(285))).mode).toBe('disabled');
  });
});

describe('classifyTimingSet', () => {
  it('needs a 95% majority over enough observations', () => {
    expect(classifyTimingSet({hafs: 5, riwayah: 0, neither: 0})).toBe('hafs');
    expect(classifyTimingSet({hafs: 0, riwayah: 5, neither: 0})).toBe(
      'riwayah',
    );
    expect(classifyTimingSet({hafs: 0, riwayah: 4, neither: 1})).toBe(
      'unknown',
    );
    expect(classifyTimingSet({hafs: 1, riwayah: 49, neither: 0})).toBe(
      'riwayah',
    );
    expect(classifyTimingSet({hafs: 3, riwayah: 47, neither: 0})).toBe(
      'unknown',
    );
    expect(classifyTimingSet({hafs: 0, riwayah: 2, neither: 0})).toBeNull();
  });
});

describe('createTimingNumbering (rewayah-numbered)', () => {
  const warsh2 = timings('warsh-14', 2);
  const n = numbering('riwayah', 'warsh', 2, warsh2);

  it('maps every al-Baqarah entry to exactly the Hafs verses it recites', () => {
    for (const e of warsh2) {
      const expected = oracleHafsAyahs('warsh', 2, e.ayahNumber).map(
        a => `2:${a}`,
      );
      expect(n.hafsKeysForEntry(e.ayahNumber)).toEqual(expected);
    }
  });

  it('starts a Hafs verse at the first entry containing it', () => {
    expect(n.startEntryForHafsAyah(5)?.ayahNumber).toBe(4);
    expect(n.startEntryForHafsAyah(1)?.ayahNumber).toBe(1);
    expect(n.startEntryForHafsAyah(2)?.ayahNumber).toBe(1);
    expect(n.startEntryForHafsAyah(255)?.ayahNumber).toBe(253);
    expect(n.startEntryForHafsAyah(286)?.ayahNumber).toBe(285);
  });

  it('ends a range on the last entry containing the Hafs verse', () => {
    expect(n.endEntryAyahForHafsAyah(37)).toBe(36);
    expect(n.endEntryAyahForHafsAyah(255)).toBe(254);
    expect(n.endEntryAyahForHafsAyah(286)).toBe(285);
    expect(n.entryRangeForHafsAyah(255)).toEqual({start: 253, end: 254});
    expect(n.entryRangeForHafsAyah(5)).toEqual({start: 4, end: 4});
    expect(n.entryAyahsForHafsAyah(2)).toEqual([1]);
  });

  // @ai-start
  it('resolves the Fatiha basmala (no Madani verse) to the nearest real reciter verse', () => {
    const f = numbering('riwayah', 'warsh', 1, timings('warsh-14', 1));
    expect(f.entryAyahsForHafsAyah(1)).toEqual([]);
    expect(f.startEntryForHafsAyah(1)?.ayahNumber).toBe(1);
    // Nothing precedes it: a range ending there ends on the reciter's verse 1
    // (it used to resolve to nothing, so the range ended before it began).
    expect(f.endEntryAyahForHafsAyah(1)).toBe(1);
    expect(f.entryRangeForHafsAyah(1)).toEqual({start: 1, end: 1});
    expect(f.hafsKeysForEntry(1)).toEqual(['1:2']);
    expect(f.entryRangeForHafsAyah(7)).toEqual({start: 6, end: 7});
    // Hafs verses that the reciter does recite are unaffected
    expect(f.endEntryAyahForHafsAyah(2)).toBe(1);
    expect(f.startEntryForHafsAyah(7)?.ayahNumber).toBe(6);
    expect(f.endEntryAyahForHafsAyah(7)).toBe(7);
  });

  it.each([
    ['warsh' as RewayahId],
    ['qalun' as RewayahId],
    ['al-duri-abi-amr' as RewayahId],
    ['al-susi' as RewayahId],
  ])(
    '%s (basmala is not a verse): every unit at Hafs 1:1 is the reciter verse 1',
    rewayah => {
      expect(verseMap.toRiwayahKeys(rewayah, '1:1')).toEqual([]);
      const count = verseMap.verseCount(rewayah, 1)!;
      const f = numbering('riwayah', rewayah, 1, synthetic(1, range(count)));
      expect(f.startEntryForHafsAyah(1)?.ayahNumber).toBe(1);
      expect(f.endEntryAyahForHafsAyah(1)).toBe(1);
      expect(f.entryRangeForHafsAyah(1)).toEqual({start: 1, end: 1});
      expect(f.hafsKeysForEntry(1)).toEqual(['1:2']);
    },
  );

  it('al-Bazzi (Makki count): the basmala is a verse, nothing to resolve', () => {
    const f = numbering(
      'riwayah',
      'al-bazzi',
      1,
      synthetic(1, range(verseMap.verseCount('al-bazzi', 1)!)),
    );
    expect(f.entryAyahsForHafsAyah(1)).toEqual([1]);
    expect(f.endEntryAyahForHafsAyah(1)).toBe(1);
    expect(f.hafsKeysForEntry(1)).toEqual(['1:1']);
  });
  // @ai-end

  it('never emits a key that does not exist in Hafs (al-Bazzi 112:5)', () => {
    const b = numbering('riwayah', 'al-bazzi', 112, timings('bazzi-296', 112));
    expect([1, 2, 3, 4, 5].map(a => b.hafsKeysForEntry(a))).toEqual([
      ['112:1'],
      ['112:2'],
      ['112:3'],
      ['112:3'],
      ['112:4'],
    ]);
    expect(b.endEntryAyahForHafsAyah(4)).toBe(5);
    expect(b.entryAyahsForHafsAyah(3)).toEqual([3, 4]);
  });
});

describe('createTimingNumbering (identity and disabled)', () => {
  it('identity keeps the historical behaviour, including ayah 0', () => {
    const entries = timings('hafs-preroll', 112);
    const n = numbering('hafs', 'hafs', 112, entries);
    expect(n.hafsKeysForEntry(0)).toEqual(['112:0']);
    expect(n.hafsKeysForEntry(3)).toEqual(['112:3']);
    expect(n.startEntryForHafsAyah(2)).toBe(entries[2]);
    expect(n.startEntryForHafsAyah(9)).toBeNull();
    expect(n.endEntryAyahForHafsAyah(4)).toBe(4);
  });

  it('disabled answers nothing', () => {
    const n = numbering(
      'disabled',
      'al-duri-abi-amr',
      67,
      timings('doori-269', 67),
    );
    expect(n.mode).toBe('disabled');
    expect(n.hafsKeysForEntry(5)).toEqual([]);
    expect(n.startEntryForHafsAyah(5)).toBeNull();
    expect(n.endEntryAyahForHafsAyah(5)).toBeNull();
    expect(n.entryAyahsForHafsAyah(5)).toEqual([]);
  });

  it('riwayah without a rewayah degrades to disabled', () => {
    const n = numbering('riwayah', null, 2, timings('warsh-14', 2));
    expect(n.mode).toBe('disabled');
  });
});

describe('registry', () => {
  it('stores the numbering per timestamps array', () => {
    const a = timings('warsh-14', 2);
    const b = timings('warsh-14', 2); // equal content, different array
    const n = numbering('riwayah', 'warsh', 2, a);
    registerTimingNumbering(a, n);
    expect(getRegisteredTimingNumbering(a)).toBe(n);
    expect(getRegisteredTimingNumbering(b)).toBeUndefined();
    registerTimingNumbering(b, 'pending');
    expect(getRegisteredTimingNumbering(b)).toBe('pending');
  });
});

describe('labels', () => {
  it('formats verse key ranges', () => {
    expect(formatVerseKeyRange([])).toBeNull();
    expect(formatVerseKeyRange(['2:5'])).toBe('2:5');
    expect(formatVerseKeyRange(['2:1', '2:2'])).toBe('2:1-2');
    expect(formatVerseKeyRange(['2:286', '3:1'])).toBe('2:286-3:1');
  });

  const label = (
    hafsKeys: string[],
    reciterVerseKey: string,
    mode: TimingNumberingMode,
    reciterRewayah: RewayahId,
    mushafRewayah: RewayahId,
  ) =>
    formatPlaybackVerseLabel({
      hafsKeys,
      reciterVerseKey,
      mode,
      reciterRewayah,
      mushafRewayah,
      verseMap,
    });

  it('uses the numbering of the mushaf on screen', () => {
    // Warsh reciter, entry 2:4 (= Hafs 2:5)
    expect(label(['2:5'], '2:4', 'riwayah', 'warsh', 'warsh')).toBe('2:4');
    expect(label(['2:5'], '2:4', 'riwayah', 'warsh', 'hafs')).toBe('2:5');
    // Warsh entry 2:1 recites Hafs 2:1 + 2:2
    expect(label(['2:1', '2:2'], '2:1', 'riwayah', 'warsh', 'hafs')).toBe(
      '2:1-2',
    );
    // Hafs reciter in a Warsh mushaf: Warsh numbering of the Hafs verse
    expect(label(['2:5'], '2:5', 'hafs', 'hafs', 'warsh')).toBe('2:4');
    // Hafs-numbered Warsh set in a Warsh mushaf
    expect(label(['2:255'], '2:255', 'hafs', 'warsh', 'warsh')).toBe(
      '2:253-254',
    );
    expect(label([], '2:4', 'riwayah', 'warsh', 'warsh')).toBeNull();
  });
});

// @ai-start
describe('verse key list ids (value-comparable selector results)', () => {
  it('round-trips and is the key itself for a single verse', () => {
    expect(verseKeyListId([])).toBe('');
    expect(verseKeyListId(['2:5'])).toBe('2:5');
    expect(parseVerseKeyListId('')).toEqual([]);
    expect(parseVerseKeyListId(verseKeyListId(['2:1', '2:2']))).toEqual([
      '2:1',
      '2:2',
    ]);
  });

  it('selectTrackedVerseKeysId lists every Hafs verse being recited', () => {
    expect(selectTrackedVerseKeysId({currentAyah: null})).toBe('');
    const legacy = {
      surahNumber: 2,
      ayahNumber: 5,
      verseKey: '2:5',
      timestampFrom: 0,
      timestampTo: 1,
    };
    // Hafs (and states written by older code): the verse key itself
    expect(selectTrackedVerseKeysId({currentAyah: legacy})).toBe('2:5');
    const mapped = {
      ...legacy,
      ayahNumber: 1,
      verseKey: '2:1',
      verseKeys: ['2:1', '2:2'],
      reciterVerseKey: '2:1',
    };
    expect(
      parseVerseKeyListId(selectTrackedVerseKeysId({currentAyah: mapped})),
    ).toEqual(['2:1', '2:2']);
  });
});
// @ai-end

describe('getTrackedVerseKeys', () => {
  it('reads mapped keys and falls back to the legacy single key', () => {
    expect(getTrackedVerseKeys(null)).toEqual([]);
    const legacy = {
      surahNumber: 2,
      ayahNumber: 5,
      verseKey: '2:5',
      timestampFrom: 0,
      timestampTo: 1,
    };
    expect(getTrackedVerseKeys(legacy)).toEqual(['2:5']);
    expect(
      getTrackedVerseKeys({
        ...legacy,
        ayahNumber: 1,
        verseKey: '2:1',
        verseKeys: ['2:1', '2:2'],
        reciterVerseKey: '2:1',
      } as typeof legacy),
    ).toEqual(['2:1', '2:2']);
  });
});
