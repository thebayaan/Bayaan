// @ai-generated
/**
 * TimingNumbering's verse-unit answers (verse-units contract 4.2), checked
 * against the real verse units of real Release 1 word slots (a few complete
 * surahs of the Hafs, Shu'bah, Warsh, al-Bazzi and al-Duri words DBs) and
 * real timing files:
 *  - a set numbered by the shown rewayah: one unit is one entry;
 *  - any other set: the units holding the Hafs verses an entry recites
 *    (units.unitsForHafsKeys, the contract's rule), and a unit plays the
 *    entries holding its words, starting at its storage anchor's Hafs verse;
 *  - Hafs units: exactly the Hafs answers (differential).
 */

import {rewayahVerseMapService} from '@/services/mushaf/RewayahVerseMapService';
import type {
  RewayahVerseUnits,
  VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {AyahTimestamp} from '@/types/timestamps';
import {loadTimings} from '@/services/timestamps/__fixtures__/timingFixtures';
import {
  fixtureUnit,
  fixtureVerseUnits,
  unitFixtureSurahs,
  type UnitFixtureDb,
} from '@/services/timestamps/__fixtures__/verseUnitFixtures';
import {
  compareAudioUnits,
  createTimingNumbering,
  formatUnitKeysLabel,
  formatVerseKeyRange,
  getTrackedUnitKeys,
  hafsKeysToUnitKeys,
  toAudioUnitTarget,
  type MappedAyahTrackingState,
  type TimingNumbering,
  type TimingNumberingMode,
} from '../timestampNumbering';

const verseMap = rewayahVerseMapService;

function timings(set: string, surah: number): AyahTimestamp[] {
  const t = loadTimings(set, surah);
  if (!t) throw new Error(`missing fixture ${set}/${surah}`);
  return t;
}

/** Entries 1..n (an optional ayah-0 pre-roll first), 1 s apart. */
function synthetic(surah: number, count: number, preroll = false) {
  const ayahs = Array.from({length: count}, (_, i) => i + 1);
  return (preroll ? [0, ...ayahs] : ayahs).map((a, i) => ({
    surahNumber: surah,
    ayahNumber: a,
    timestampFrom: i * 1000,
    timestampTo: (i + 1) * 1000,
    durationMs: 1000,
  }));
}

function numbering(
  mode: TimingNumberingMode,
  reciterRewayah: RewayahId | null,
  surah: number,
  entries: readonly AyahTimestamp[],
): TimingNumbering {
  return createTimingNumbering({
    surah,
    mode,
    reciterRewayah,
    reason: 'test',
    entries,
    verseMap,
  });
}

const keysOf = (units: readonly VerseUnit[]) => units.map(u => u.key);
const hafsAyahOf = (key: string) => Number(key.split(':')[1]);

const DBS: UnitFixtureDb[] = ['warsh', 'bazzi', 'doori', 'shouba', 'hafs'];

describe('audio targets of verse units', () => {
  it('keep the rewayah, the own number and the Hafs extent', () => {
    expect(toAudioUnitTarget(fixtureUnit('warsh', '1:7'))).toEqual({
      rewayah: 'warsh',
      surah: 1,
      ayah: 7,
      key: '1:7',
      hafsFirstAyah: 7,
      hafsLastAyah: 7,
    });
    expect(toAudioUnitTarget(fixtureUnit('warsh', '103:1'))).toMatchObject({
      key: '103:1',
      hafsFirstAyah: 1,
      hafsLastAyah: 2,
    });
    // al-Bazzi 71:24 = the end of Hafs 71:23 and the start of Hafs 71:24
    expect(toAudioUnitTarget(fixtureUnit('bazzi', '71:24'))).toMatchObject({
      hafsFirstAyah: 23,
      hafsLastAyah: 24,
    });
    const target = toAudioUnitTarget(fixtureUnit('hafs', '112:3'));
    expect(target).toEqual({
      rewayah: 'hafs',
      surah: 112,
      ayah: 3,
      key: '112:3',
      hafsFirstAyah: 3,
      hafsLastAyah: 3,
    });
    expect(toAudioUnitTarget(target)).toBe(target);
  });

  it("start at the unit's storage anchor (its first slot's Hafs verse)", () => {
    for (const db of DBS) {
      const units = fixtureVerseUnits(db);
      for (const unit of units.units) {
        expect(`${unit.surah}:${toAudioUnitTarget(unit).hafsFirstAyah}`).toBe(
          units.hafsAnchor(unit).hafsKey,
        );
      }
    }
  });

  it('refuse a unit without Hafs verses in its surah', () => {
    const broken = {...fixtureUnit('warsh', '1:1'), hafsKeys: ['2:1']};
    expect(() => toAudioUnitTarget(broken)).toThrow(/no Hafs verses/);
  });

  it('compare in reading order', () => {
    const t = (key: string) => toAudioUnitTarget(fixtureUnit('warsh', key));
    expect(compareAudioUnits(t('1:6'), t('1:7'))).toBeLessThan(0);
    expect(compareAudioUnits(t('103:1'), t('1:7'))).toBeGreaterThan(0);
    expect(compareAudioUnits(t('1:7'), t('1:7'))).toBe(0);
  });
});

describe('hafsKeysToUnitKeys (the safe Hafs-keyed mapping)', () => {
  it('equals units.unitsForHafsKey for every Hafs verse of the fixture', () => {
    for (const db of DBS) {
      const units = fixtureVerseUnits(db);
      for (const surah of unitFixtureSurahs()) {
        for (let ayah = 1; ; ayah++) {
          const hafsKey = `${surah}:${ayah}`;
          if (!units.hafsVerseWordRange(hafsKey)) break;
          expect(hafsKeysToUnitKeys([hafsKey], units.rewayah)).toEqual(
            keysOf(units.unitsForHafsKey(hafsKey)),
          );
        }
      }
    }
  });

  it('is the identity for Hafs and empty without a verse map', () => {
    expect(hafsKeysToUnitKeys(['1:7', '2:1'], 'hafs')).toEqual(['1:7', '2:1']);
    expect(hafsKeysToUnitKeys(['1:7'], 'hisham')).toEqual([]);
    // the Fatiha basmala is no verse in the Madani count
    expect(hafsKeysToUnitKeys(['1:1'], 'warsh')).toEqual([]);
    expect(hafsKeysToUnitKeys(['1:7', '1:7'], 'warsh')).toEqual(['1:6', '1:7']);
  });
});

describe('a set numbered by the shown rewayah: one unit = one entry', () => {
  const cases: [UnitFixtureDb, string, number][] = [
    ['warsh', 'warsh-14', 1],
    ['warsh', 'warsh-14', 106],
    ['warsh', 'warsh-14', 107],
    ['warsh', 'warsh-14', 112],
    ['bazzi', 'bazzi-296', 112],
  ];

  it.each(cases)('%s units with %s, surah %i', (db, set, surah) => {
    const units = fixtureVerseUnits(db);
    const n = numbering('riwayah', units.rewayah, surah, timings(set, surah));
    expect(n.numbersVersesOf(units.rewayah)).toBe(true);
    for (const u of units.unitsOfSurah(surah)) {
      const t = toAudioUnitTarget(u);
      expect(n.startEntryForUnit(t)?.ayahNumber).toBe(u.ayah);
      expect(n.endEntryAyahForUnit(t)).toBe(u.ayah);
      expect(n.entryRangeForUnit(t)).toEqual({start: u.ayah, end: u.ayah});
      // contract 4.2: the band is exactly units.unitByRef(surah, entry)
      expect(n.unitKeysForEntry(u.ayah, units.rewayah)).toEqual([
        units.unitByRef(surah, u.ayah)!.key,
      ]);
    }
    expect(n.unitKeysForEntry(0, units.rewayah)).toEqual([]);
    expect(
      n.unitKeysForEntry(units.verseCount(surah) + 1, units.rewayah),
    ).toEqual([]);
  });

  it('the two parts of a split Hafs verse are two entries, two bands', () => {
    const warsh = fixtureVerseUnits('warsh');
    const n = numbering('riwayah', 'warsh', 1, timings('warsh-14', 1));
    expect(n.unitKeysForEntry(6, 'warsh')).toEqual(['1:6']);
    expect(n.unitKeysForEntry(7, 'warsh')).toEqual(['1:7']);
    // both are Hafs 1:7 (page turns and Hafs painters)
    expect(n.hafsKeysForEntry(6)).toEqual(['1:7']);
    expect(n.hafsKeysForEntry(7)).toEqual(['1:7']);
    // Hafs-keyed answers are unchanged: Hafs 1:7 is entries 6-7
    expect(n.entryRangeForHafsAyah(7)).toEqual({start: 6, end: 7});
    expect(
      n.entryRangeForUnit(toAudioUnitTarget(warsh.unitByKey('1:7')!)),
    ).toEqual({start: 7, end: 7});
  });

  it('a unit of another surah has no entry', () => {
    const n = numbering('riwayah', 'warsh', 1, timings('warsh-14', 1));
    const t = toAudioUnitTarget(fixtureUnit('warsh', '106:4'));
    expect(n.startEntryForUnit(t)).toBeNull();
    expect(n.endEntryAyahForUnit(t)).toBeNull();
    expect(n.entryRangeForUnit(t)).toBeNull();
  });
});

describe('any other set: the Hafs-keyed mapping (contract 4.2)', () => {
  /**
   * The contract's rule for a unit u of a set that does not number u's
   * rewayah: start = startEntryForHafsAyah(hafsAnchor(u).ayah), end =
   * endEntryAyahForHafsAyah(Hafs ayah of u's last Hafs verse); band of an
   * entry = units.unitsForHafsKeys(hafsKeysForEntry(entry)).
   */
  function expectContractRule(n: TimingNumbering, units: RewayahVerseUnits) {
    const surah = n.surah;
    for (const u of units.unitsOfSurah(surah)) {
      const t = toAudioUnitTarget(u);
      const start = n.startEntryForHafsAyah(units.hafsAnchor(u).ayah);
      const end = n.endEntryAyahForHafsAyah(
        hafsAyahOf(u.hafsKeys[u.hafsKeys.length - 1]),
      );
      expect(n.startEntryForUnit(t)).toBe(start);
      expect(n.endEntryAyahForUnit(t)).toBe(end);
      expect(n.entryRangeForUnit(t)).toEqual(
        start
          ? {start: start.ayahNumber, end: Math.max(start.ayahNumber, end!)}
          : null,
      );
    }
  }

  function expectContractBand(
    n: TimingNumbering,
    units: RewayahVerseUnits,
    entries: readonly AyahTimestamp[],
  ) {
    for (const e of entries) {
      expect(n.unitKeysForEntry(e.ayahNumber, units.rewayah)).toEqual(
        keysOf(units.unitsForHafsKeys(n.hafsKeysForEntry(e.ayahNumber))),
      );
    }
  }

  it('Hafs-numbered Warsh set (Warsh 134) in a Warsh mushaf', () => {
    const warsh = fixtureVerseUnits('warsh');
    for (const surah of [1, 106, 107]) {
      const entries = timings('warsh-134', surah);
      const n = numbering('hafs', 'warsh', surah, entries);
      expect(n.numbersVersesOf('warsh')).toBe(false);
      expectContractRule(n, warsh);
      expectContractBand(n, warsh, entries);
    }
    const n = numbering('hafs', 'warsh', 1, timings('warsh-134', 1));
    // the basmala entry lights no Warsh verse
    expect(n.unitKeysForEntry(1, 'warsh')).toEqual([]);
    // the Hafs 1:7 entry lights both Warsh parts
    expect(n.unitKeysForEntry(7, 'warsh')).toEqual(['1:6', '1:7']);
    // both parts play the whole Hafs 1:7 entry
    for (const key of ['1:6', '1:7']) {
      const t = toAudioUnitTarget(fixtureUnit('warsh', key));
      expect(n.entryRangeForUnit(t)).toEqual({start: 7, end: 7});
    }
    // Warsh 107:6 holds Hafs 107:6 + 107:7: both entries
    const m = numbering('hafs', 'warsh', 107, timings('warsh-134', 107));
    expect(
      m.entryRangeForUnit(toAudioUnitTarget(fixtureUnit('warsh', '107:6'))),
    ).toEqual({start: 6, end: 7});
  });

  it('a set numbered by another rewayah (Warsh 14 in an al-Duri mushaf)', () => {
    const doori = fixtureVerseUnits('doori');
    for (const surah of [1, 106, 107, 112]) {
      const entries = timings('warsh-14', surah);
      const n = numbering('riwayah', 'warsh', surah, entries);
      expect(n.numbersVersesOf('al-duri-abi-amr')).toBe(false);
      expectContractRule(n, doori);
      expectContractBand(n, doori, entries);
    }
    const n = numbering('riwayah', 'warsh', 1, timings('warsh-14', 1));
    expect(n.unitKeysForEntry(6, 'al-duri-abi-amr')).toEqual(['1:6', '1:7']);
    // al-Duri 1:7 starts with the whole Hafs 1:7, i.e. Warsh entry 6
    expect(
      n.entryRangeForUnit(toAudioUnitTarget(fixtureUnit('doori', '1:7'))),
    ).toEqual({start: 6, end: 7});
  });

  it('al-Bazzi 112 (Makki) shown in Warsh and in Hafs', () => {
    const entries = timings('bazzi-296', 112);
    const n = numbering('riwayah', 'al-bazzi', 112, entries);
    expectContractRule(n, fixtureVerseUnits('warsh'));
    expectContractBand(n, fixtureVerseUnits('warsh'), entries);
    expectContractRule(n, fixtureVerseUnits('hafs'));
    // al-Bazzi 112:3 and 112:4 are both Hafs 112:3
    expect(n.unitKeysForEntry(3, 'hafs')).toEqual(['112:3']);
    expect(n.unitKeysForEntry(4, 'hafs')).toEqual(['112:3']);
    expect(n.unitKeysForEntry(4, 'warsh')).toEqual(['112:3']);
  });

  it('a disabled numbering answers nothing', () => {
    const n = numbering('disabled', 'al-duri-abi-amr', 1, synthetic(1, 7));
    const t = toAudioUnitTarget(fixtureUnit('doori', '1:1'));
    expect(n.numbersVersesOf('al-duri-abi-amr')).toBe(false);
    expect(n.startEntryForUnit(t)).toBeNull();
    expect(n.endEntryAyahForUnit(t)).toBeNull();
    expect(n.entryRangeForUnit(t)).toBeNull();
    expect(n.unitKeysForEntry(1, 'al-duri-abi-amr')).toEqual([]);
    expect(n.unitKeysForEntry(1, 'hafs')).toEqual([]);
  });
});

describe('Hafs units: exactly the Hafs answers', () => {
  const sets: [string, TimingNumberingMode, RewayahId, number][] = [
    ['hafs-clean', 'hafs', 'hafs', 1],
    ['hafs-clean', 'hafs', 'hafs', 112],
    ['hafs-preroll', 'hafs', 'hafs', 112],
    ['shubah-305', 'hafs', 'shubah', 1],
    ['shubah-305', 'hafs', 'shubah', 112],
    ['warsh-14', 'riwayah', 'warsh', 1],
    ['warsh-14', 'riwayah', 'warsh', 106],
    ['warsh-14', 'riwayah', 'warsh', 107],
    ['warsh-134', 'hafs', 'warsh', 1],
    ['warsh-134', 'hafs', 'warsh', 107],
    ['bazzi-296', 'riwayah', 'al-bazzi', 112],
  ];

  it.each(sets)('%s (%s, %s) surah %i', (set, mode, rewayah, surah) => {
    const entries = timings(set, surah);
    const n = numbering(mode, rewayah, surah, entries);
    const hafs = fixtureVerseUnits('hafs');
    expect(n.numbersVersesOf('hafs')).toBe(false);
    for (const u of hafs.unitsOfSurah(surah)) {
      const t = toAudioUnitTarget(u);
      expect(n.startEntryForUnit(t)).toBe(n.startEntryForHafsAyah(u.ayah));
      expect(n.endEntryAyahForUnit(t)).toBe(n.endEntryAyahForHafsAyah(u.ayah));
      expect(n.entryRangeForUnit(t)).toEqual(n.entryRangeForHafsAyah(u.ayah));
    }
    for (const e of entries) {
      expect(n.unitKeysForEntry(e.ayahNumber, 'hafs')).toEqual(
        n.hafsKeysForEntry(e.ayahNumber),
      );
    }
    // Shu'bah units are the Hafs verses too
    const shouba = fixtureVerseUnits('shouba');
    for (const u of shouba.unitsOfSurah(surah)) {
      expect(u.hafsKeys).toEqual([u.key]);
    }
  });

  it('the band label of a Hafs band is the historical label', () => {
    const bands = [
      ['2:5'],
      ['2:1', '2:2'],
      ['112:0'],
      ['1:6', '1:7'],
      ['30:1', '30:2', '30:3'],
    ];
    for (const keys of bands) {
      expect(formatUnitKeysLabel(keys)).toBe(formatVerseKeyRange(keys));
    }
    expect(formatUnitKeysLabel([])).toBeNull();
  });
});

describe('getTrackedUnitKeys (the main player band of verse rows)', () => {
  const state = (
    verseKeys: string[],
    reciterVerseKey: string,
  ): MappedAyahTrackingState => ({
    surahNumber: Number(reciterVerseKey.split(':')[0]),
    ayahNumber: Number(verseKeys[0].split(':')[1]),
    verseKey: verseKeys[0],
    timestampFrom: 0,
    timestampTo: 1,
    verseKeys,
    reciterVerseKey,
  });

  it("exactly the reciter's verse when the set numbers the rows' rewayah", () => {
    const n = numbering('riwayah', 'warsh', 1, timings('warsh-14', 1));
    expect(getTrackedUnitKeys(state(['1:7'], '1:6'), 'warsh', n)).toEqual([
      '1:6',
    ]);
    expect(getTrackedUnitKeys(state(['1:7'], '1:7'), 'warsh', n)).toEqual([
      '1:7',
    ]);
  });

  it('otherwise every verse holding a word of what is recited', () => {
    const n = numbering('riwayah', 'warsh', 1, timings('warsh-14', 1));
    // rows of another rewayah
    expect(
      getTrackedUnitKeys(state(['1:7'], '1:6'), 'al-duri-abi-amr', n),
    ).toEqual(['1:6', '1:7']);
    // a Hafs-numbered set
    const h = numbering('hafs', 'warsh', 1, timings('warsh-134', 1));
    expect(getTrackedUnitKeys(state(['1:7'], '1:7'), 'warsh', h)).toEqual([
      '1:6',
      '1:7',
    ]);
    expect(getTrackedUnitKeys(state(['1:1'], '1:1'), 'warsh', h)).toEqual([]);
    // numbering pending or unknown, a numbering of another surah
    expect(
      getTrackedUnitKeys(state(['1:7'], '1:6'), 'warsh', 'pending'),
    ).toEqual(['1:6', '1:7']);
    expect(
      getTrackedUnitKeys(state(['1:7'], '1:6'), 'warsh', undefined),
    ).toEqual(['1:6', '1:7']);
    const other = numbering('riwayah', 'warsh', 106, timings('warsh-14', 106));
    expect(getTrackedUnitKeys(state(['1:7'], '1:6'), 'warsh', other)).toEqual([
      '1:6',
      '1:7',
    ]);
    // a legacy state without the reciter's key
    expect(
      getTrackedUnitKeys(
        {
          surahNumber: 2,
          ayahNumber: 2,
          verseKey: '2:2',
          timestampFrom: 0,
          timestampTo: 1,
        },
        'warsh',
        n,
      ),
    ).toEqual(['2:1']);
    expect(getTrackedUnitKeys(null, 'warsh', n)).toEqual([]);
  });

  it('Hafs rows: the tracked Hafs keys, unchanged', () => {
    const n = numbering('riwayah', 'warsh', 1, timings('warsh-14', 1));
    expect(getTrackedUnitKeys(state(['1:7'], '1:6'), 'hafs', n)).toEqual([
      '1:7',
    ]);
    expect(
      getTrackedUnitKeys(state(['2:1', '2:2'], '2:1'), 'hafs', undefined),
    ).toEqual(['2:1', '2:2']);
  });
});
