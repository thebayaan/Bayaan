/**
 * findAyahTimestamp is how the main player's "Play from here" turns a tapped
 * (Hafs) verse into a seek position. With rewayah-numbered timings it must go
 * through the numbering the follow-along tracker registered for the array.
 */

import {rewayahVerseMapService} from '@/services/mushaf/RewayahVerseMapService';
import {loadTimings} from '@/services/timestamps/__fixtures__/timingFixtures';
import type {AyahTimestamp} from '@/types/timestamps';
import {binarySearchAyah, findAyahTimestamp} from '../timestampUtils';
import {
  createTimingNumbering,
  registerTimingNumbering,
  type TimingNumberingMode,
} from '../timestampNumbering';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

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
}

describe('findAyahTimestamp', () => {
  it('without a registered numbering looks entries up by number (Hafs sets)', () => {
    const t = fresh('hafs-clean', 2);
    expect(findAyahTimestamp(t, 5)?.ayahNumber).toBe(5);
    expect(findAyahTimestamp(t, 286)?.ayahNumber).toBe(286);
    expect(findAyahTimestamp(t, 287)).toBeNull();
    const pre = fresh('hafs-preroll', 112);
    expect(findAyahTimestamp(pre, 2)?.ayahNumber).toBe(2);
  });

  it('with a rewayah numbering returns the reciter verse that recites the Hafs verse', () => {
    const t = fresh('warsh-14', 2);
    register(t, 'riwayah', 'warsh', 2);
    expect(findAyahTimestamp(t, 5)?.ayahNumber).toBe(4);
    expect(findAyahTimestamp(t, 286)?.ayahNumber).toBe(285); // was null
    expect(findAyahTimestamp(t, 2)?.ayahNumber).toBe(1);
    expect(findAyahTimestamp(t, 255)?.ayahNumber).toBe(253);
  });

  it('with a Hafs numbering behaves exactly as before', () => {
    const t = fresh('warsh-134', 2);
    register(t, 'hafs', 'warsh', 2);
    for (const a of [1, 5, 255, 286]) {
      expect(findAyahTimestamp(t, a)?.ayahNumber).toBe(a);
    }
  });

  it('returns null while the numbering resolves or when it is disabled', () => {
    const pending = fresh('warsh-14', 1);
    registerTimingNumbering(pending, 'pending');
    expect(findAyahTimestamp(pending, 2)).toBeNull();
    const disabled = fresh('doori-269', 67);
    register(disabled, 'disabled', 'al-duri-abi-amr', 67);
    expect(findAyahTimestamp(disabled, 5)).toBeNull();
  });
});

describe('binarySearchAyah', () => {
  it('returns the entry containing a position, null before the first entry', () => {
    const t = fresh('warsh-14', 112);
    expect(binarySearchAyah(t, 0)).toBeNull();
    expect(binarySearchAyah(t, t[2].timestampFrom + 1)?.ayahNumber).toBe(3);
    expect(binarySearchAyah(t, 10_000_000)?.ayahNumber).toBe(4);
  });
});
