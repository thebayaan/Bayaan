// @ai-generated
/**
 * The main player's "Play from here" on a verse unit of its verse rows
 * (verse-units contract 4.2): with timings numbered by the rows' rewayah it
 * starts exactly at the unit's own entry (Warsh 1:7, inside Hafs 1:7, at
 * Warsh entry 7); any other set starts at the whole Hafs verse; a Hafs unit
 * gives exactly what the Hafs key gives (differential). Real timing files
 * and real verse units of real Release 1 word slots.
 */

import {rewayahVerseMapService} from '@/services/mushaf/RewayahVerseMapService';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {loadTimings} from '@/services/timestamps/__fixtures__/timingFixtures';
import {
  fixtureUnit,
  fixtureVerseUnits,
} from '@/services/timestamps/__fixtures__/verseUnitFixtures';
import type {AyahTimestamp} from '@/types/timestamps';
import {
  findAyahTimestamp,
  findUnitTimestamp,
  getPlayFromHereTarget,
  getPlayFromUnitTarget,
  PLAY_FROM_HERE_PENDING,
  PLAY_FROM_HERE_UNAVAILABLE,
} from '../timestampUtils';
import {
  createTimingNumbering,
  registerTimingNumbering,
  toAudioUnitTarget,
  type TimingNumberingMode,
} from '../timestampNumbering';

function fresh(set: string, surah: number): AyahTimestamp[] {
  const t = loadTimings(set, surah);
  if (!t) throw new Error(`missing fixture ${set}/${surah}`);
  return t; // a new array each call: registrations do not leak across tests
}

function register(
  entries: AyahTimestamp[],
  mode: TimingNumberingMode,
  rewayah: RewayahId,
  surah: number,
) {
  registerTimingNumbering(
    entries,
    createTimingNumbering({
      surah,
      mode,
      reciterRewayah: rewayah,
      reason: 'test',
      entries,
      verseMap: rewayahVerseMapService,
    }),
  );
  return entries;
}

const W = (key: string) => fixtureUnit('warsh', key);

describe('findUnitTimestamp', () => {
  it("timings numbered by the unit's rewayah: exactly its own entry", () => {
    const t = register(fresh('warsh-14', 1), 'riwayah', 'warsh', 1);
    expect(findUnitTimestamp(t, W('1:6'))?.ayahNumber).toBe(6);
    expect(findUnitTimestamp(t, W('1:7'))?.ayahNumber).toBe(7);
    // the Hafs-keyed lookup of Hafs 1:7 starts at Warsh 1:6
    expect(findAyahTimestamp(t, 7)?.ayahNumber).toBe(6);
  });

  it('any other timings: where its first Hafs verse starts', () => {
    const hafsNumbered = register(fresh('warsh-134', 1), 'hafs', 'warsh', 1);
    expect(findUnitTimestamp(hafsNumbered, W('1:7'))?.ayahNumber).toBe(7);
    expect(findUnitTimestamp(hafsNumbered, W('1:1'))?.ayahNumber).toBe(2);
    const otherRewayah = register(fresh('warsh-14', 1), 'riwayah', 'warsh', 1);
    expect(
      findUnitTimestamp(otherRewayah, fixtureUnit('doori', '1:7'))?.ayahNumber,
    ).toBe(6);
    // without a registered numbering the timings are Hafs-numbered
    const plain = fresh('hafs-clean', 1);
    expect(findUnitTimestamp(plain, W('1:7'))?.ayahNumber).toBe(7);
  });

  it('nothing while the numbering resolves, when it is disabled, or for another surah', () => {
    const pending = fresh('warsh-14', 1);
    registerTimingNumbering(pending, 'pending');
    expect(findUnitTimestamp(pending, W('1:7'))).toBeNull();
    const disabled = register(fresh('doori-269', 67), 'disabled', 'warsh', 67);
    expect(findUnitTimestamp(disabled, W('1:7'))).toBeNull();
    const t = register(fresh('warsh-14', 106), 'riwayah', 'warsh', 106);
    expect(findUnitTimestamp(t, W('1:7'))).toBeNull();
    expect(findUnitTimestamp(fresh('hafs-clean', 112), W('1:7'))).toBeNull();
  });

  it('a Hafs unit: exactly findAyahTimestamp', () => {
    const hafs = fixtureVerseUnits('hafs');
    for (const [set, mode, rewayah, surah] of [
      ['hafs-clean', null, 'hafs', 1],
      ['hafs-clean', 'hafs', 'hafs', 112],
      ['hafs-preroll', 'hafs', 'hafs', 112],
      ['warsh-14', 'riwayah', 'warsh', 1],
      ['warsh-134', 'hafs', 'warsh', 107],
      ['bazzi-296', 'riwayah', 'al-bazzi', 112],
    ] as [string, TimingNumberingMode | null, RewayahId, number][]) {
      const t = fresh(set, surah);
      if (mode) register(t, mode, rewayah, surah);
      for (const u of hafs.unitsOfSurah(surah)) {
        expect(findUnitTimestamp(t, u)).toBe(findAyahTimestamp(t, u.ayah));
      }
    }
  });
});

describe('getPlayFromUnitTarget', () => {
  it("rewayah-numbered timings of the rows' rewayah: starts at the unit itself", () => {
    const t = register(fresh('warsh-14', 1), 'riwayah', 'warsh', 1);
    const target = getPlayFromUnitTarget(t, W('1:7'));
    expect(target.status).toBe('ready');
    if (target.status !== 'ready') return;
    expect(target.entry.ayahNumber).toBe(7);
    expect(target.tracking).toEqual({
      surahNumber: 1,
      ayahNumber: 7,
      verseKey: '1:7',
      timestampFrom: target.entry.timestampFrom,
      timestampTo: target.entry.timestampTo,
      verseKeys: ['1:7'],
      reciterVerseKey: '1:7',
    });
    // Warsh 1:6, the first part of Hafs 1:7, is what the Hafs key gives
    expect(getPlayFromUnitTarget(t, W('1:6'))).toEqual(
      getPlayFromHereTarget(t, '1:7'),
    );
    // a merged verse: Warsh 107:6 = Hafs 107:6 + 107:7
    const m = register(fresh('warsh-14', 107), 'riwayah', 'warsh', 107);
    const merged = getPlayFromUnitTarget(m, W('107:6'));
    expect(merged.status === 'ready' && merged.tracking.verseKeys).toEqual([
      '107:6',
      '107:7',
    ]);
  });

  it('any other timings start at the whole Hafs verse', () => {
    const t = register(fresh('warsh-134', 1), 'hafs', 'warsh', 1);
    for (const key of ['1:6', '1:7']) {
      expect(getPlayFromUnitTarget(t, W(key))).toEqual(
        getPlayFromHereTarget(t, '1:7'),
      );
    }
    const other = register(fresh('warsh-14', 1), 'riwayah', 'warsh', 1);
    expect(getPlayFromUnitTarget(other, fixtureUnit('doori', '1:7'))).toEqual(
      getPlayFromHereTarget(other, '1:7'),
    );
  });

  it('says why it cannot start, as the Hafs request does', () => {
    expect(getPlayFromUnitTarget(null, W('1:7'))).toEqual({
      status: 'pending',
      ...PLAY_FROM_HERE_PENDING,
    });
    const pending = fresh('warsh-14', 1);
    registerTimingNumbering(pending, 'pending');
    expect(getPlayFromUnitTarget(pending, W('1:7'))).toEqual({
      status: 'pending',
      ...PLAY_FROM_HERE_PENDING,
    });
    const disabled = register(fresh('doori-269', 67), 'disabled', 'warsh', 67);
    expect(getPlayFromUnitTarget(disabled, W('1:7'))).toEqual({
      status: 'unavailable',
      ...PLAY_FROM_HERE_UNAVAILABLE,
    });
  });

  it('a Hafs unit: exactly getPlayFromHereTarget with its key', () => {
    const hafs = fixtureVerseUnits('hafs');
    for (const [set, mode, rewayah, surah] of [
      ['hafs-clean', null, 'hafs', 1],
      ['hafs-clean', 'hafs', 'hafs', 112],
      ['hafs-preroll', 'hafs', 'hafs', 112],
      ['shubah-305', 'hafs', 'shubah', 1],
      ['warsh-14', 'riwayah', 'warsh', 1],
      ['warsh-14', 'riwayah', 'warsh', 106],
      ['warsh-134', 'hafs', 'warsh', 107],
      ['bazzi-296', 'riwayah', 'al-bazzi', 112],
    ] as [string, TimingNumberingMode | null, RewayahId, number][]) {
      const t = fresh(set, surah);
      if (mode) register(t, mode, rewayah, surah);
      for (const u of hafs.unitsOfSurah(surah)) {
        expect(getPlayFromUnitTarget(t, u)).toEqual(
          getPlayFromHereTarget(t, u.key),
        );
        expect(getPlayFromUnitTarget(t, toAudioUnitTarget(u))).toEqual(
          getPlayFromHereTarget(t, u.key),
        );
      }
    }
  });
});
