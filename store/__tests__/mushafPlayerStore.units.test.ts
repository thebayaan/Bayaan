// @ai-generated
/**
 * Mushaf player in the rewayah's OWN verses (decision 3, verse-units
 * contract 4.2).
 *
 * Drives the real store/mushafPlayerStore.ts + MushafAudioService against
 * real R2 timing files (services/timestamps/__fixtures__/timings) with a fake
 * expo-audio player, and real verse units built from real Release 1 word
 * slots (services/timestamps/__fixtures__/verseUnitFixtures.ts):
 *
 *  - reciter numbered in the rewayah on screen (Warsh 14 in a Warsh mushaf,
 *    al-Bazzi 296 in an al-Bazzi mushaf): one verse unit is exactly one
 *    timing entry. The band moves at the rewayah's own verse ends, also
 *    inside a split Hafs verse (Warsh 1:6 / 1:7 = Hafs 1:7); Repeat loops
 *    one rewayah verse; a range stops at its last verse; Play from here
 *    starts there; the label is the rewayah's own number;
 *  - Hafs-numbered reciter, or a reciter of another rewayah: the safe
 *    Hafs-keyed mapping (an entry lights every unit holding a word of what
 *    it recites; a unit plays the whole entries holding its words);
 *  - Hafs: the unit API gives exactly what the Hafs API gives (differential
 *    over every observable store field, seek and heard entry).
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {AyahTimestamp} from '@/types/timestamps';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

interface MockPlayer {
  uri: string;
  currentTime: number;
  duration: number;
  loop: boolean;
  playing: boolean;
  seeks: number[];
  listeners: ((status: {didJustFinish: boolean}) => void)[];
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  setPlaybackRate(rate: number): void;
  addListener(
    event: string,
    cb: (status: {didJustFinish: boolean}) => void,
  ): {remove(): void};
  remove(): void;
}

const mockPlayers: MockPlayer[] = [];
/** Pages: ordered Hafs verse keys and the first word slot of the first one. */
const mockPages: Record<number, {keys: string[]; firstWordId: number}> = {};
/** Rewayat whose verse units are not available (refused or not loaded). */
const mockUnitsUnavailable = new Set<string>();
/** Listeners of subscribeVerseUnitsChanges (the words cache). */
const mockUnitsListeners = new Set<() => void>();

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(({uri}: {uri: string}) => {
    const player: MockPlayer = {
      uri,
      currentTime: 0,
      duration: 99999,
      loop: false,
      playing: false,
      seeks: [],
      listeners: [],
      play() {
        this.playing = true;
      },
      pause() {
        this.playing = false;
      },
      seekTo(seconds: number) {
        this.currentTime = seconds;
        this.seeks.push(seconds);
        return Promise.resolve();
      },
      setPlaybackRate: jest.fn(),
      addListener(_event, cb) {
        this.listeners.push(cb);
        return {remove: jest.fn()};
      },
      remove: jest.fn(),
    };
    mockPlayers.push(player);
    return player;
  }),
}));

jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {mushafWillPlay: jest.fn(), sourceDidStop: jest.fn()},
}));

jest.mock('@/data/reciterData', () => ({
  RECITERS: jest
    .requireActual('@/services/timestamps/__fixtures__/timingFixtures')
    .fixtureCatalog(),
}));

jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {
    getTimestampsForSurah: jest.fn(async (set: string, surah: number) =>
      jest
        .requireActual('@/services/timestamps/__fixtures__/timingFixtures')
        .loadTimings(set, surah),
    ),
  },
}));

jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));

jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {
    getOrderedVerseKeysForPage: (page: number) => mockPages[page]?.keys ?? [],
    getVerseSegmentsForPage: (page: number, key: string) => {
      const p = mockPages[page];
      return p && p.keys[0] === key
        ? [{lineIndex: 0, segment: {verseKey: key, firstWordId: p.firstWordId}}]
        : [];
    },
  },
}));

// The rewayah of the mushaf on screen: a real store (it is subscribed to).
jest.mock('@/store/mushafSettingsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {useMushafSettingsStore: create(() => ({rewayah: 'hafs'}))};
});

jest.mock('@/utils/playbackVerseUnits', () => {
  const {fixtureUnitsOf} = jest.requireActual(
    '@/services/timestamps/__fixtures__/verseUnitFixtures',
  );
  const ready = (rewayah: string) =>
    mockUnitsUnavailable.has(rewayah) ? null : fixtureUnitsOf(rewayah);
  return {
    readyVerseUnits: ready,
    canShowRewayahVerses: (rewayah: string) =>
      rewayah === 'hafs' || ready(rewayah) !== null,
    subscribeVerseUnitsChanges: (listener: () => void) => {
      mockUnitsListeners.add(listener);
      return () => mockUnitsListeners.delete(listener);
    },
  };
});

jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    usePlayerStore: create(() => ({queue: {tracks: [], currentIndex: 0}})),
  };
});

jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {getPlayer: () => null},
}));

import {
  useMushafPlayerStore,
  formatPlaybackInfo,
  selectPlaybackUnitKeysId,
  selectPlaybackVerseKeysId,
  usePlaybackUnitKeys,
} from '../mushafPlayerStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {mushafAudioService} from '@/services/audio/MushafAudioService';
import {mushafLockScreenTitle} from '@/services/audio/LockScreenService';
import {timingNumberingService} from '@/services/timestamps/TimingNumberingService';
import {loadTimings} from '@/services/timestamps/__fixtures__/timingFixtures';
import {
  fixtureUnit,
  fixtureVerseUnits,
} from '@/services/timestamps/__fixtures__/verseUnitFixtures';
import {
  parseVerseKeyListId,
  type AudioUnitInput,
  type AudioUnitTarget,
} from '@/utils/timestampNumbering';
import {createAudioPlayer} from 'expo-audio';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const st = () => useMushafPlayerStore.getState();
const player = () => mockPlayers[mockPlayers.length - 1];
const W = (key: string) => fixtureUnit('warsh', key);
const B = (key: string) => fixtureUnit('bazzi', key);
const D = (key: string) => fixtureUnit('doori', key);
const H = (key: string) => fixtureUnit('hafs', key);

/** A Hafs verse as an audio target (Hafs units are the Hafs verses). */
const hafsTarget = (surah: number, ayah: number): AudioUnitTarget => ({
  rewayah: 'hafs',
  surah,
  ayah,
  key: `${surah}:${ayah}`,
  hafsFirstAyah: ayah,
  hafsLastAyah: ayah,
});

function T(set: string, surah: number): AyahTimestamp[] {
  const t = loadTimings(set, surah);
  if (!t) throw new Error(`missing fixture ${set}/${surah}`);
  return t;
}

const entry = (set: string, surah: number, ayah: number) =>
  T(set, surah).find(e => e.ayahNumber === ayah)!;

const seekOf = (set: string, surah: number, ayah: number) =>
  entry(set, surah, ayah).timestampFrom / 1000;

/** Move the playhead and let MushafAudioService's 200 ms poll run. */
function at(ms: number) {
  player().currentTime = ms / 1000;
  jest.advanceTimersByTime(200);
}

async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function display(rewayah: RewayahId) {
  (
    useMushafSettingsStore as unknown as {setState: (s: object) => void}
  ).setState({rewayah});
}

async function play(
  set: string,
  page: number,
  start?: string | AudioUnitInput,
) {
  st().setReciter(set, 'Test Reciter');
  await st().startPlayback(page, start);
}

function reset() {
  st().stop();
  st().setVerseRepeatCount(1);
  st().setRangeRepeatCount(1);
  st().clearRange();
  st().setPendingStart(null);
}

/**
 * Let the audio run forward entry by entry (finishing a surah at its last
 * entry, which may move on to the next surah) and return the entries heard
 * as "surah:entry".
 */
async function listen(maxSteps = 400): Promise<string[]> {
  const heard: string[] = [];
  for (let i = 0; i < maxSteps && st().playbackState !== 'idle'; i++) {
    const timings = mushafAudioService.getTimestamps();
    if (timings.length === 0) break;
    const surah = mushafAudioService.getCurrentSurah();
    const pos = player().currentTime * 1000;
    let idx = -1;
    for (let k = 0; k < timings.length; k++) {
      if (timings[k].timestampFrom <= pos) idx = k;
    }
    if (idx >= 0) heard.push(`${surah}:${timings[idx].ayahNumber}`);
    if (idx === timings.length - 1) {
      player().listeners.forEach(l => l({didJustFinish: true}));
      await flush();
      continue;
    }
    at(timings[idx + 1].timestampFrom + 50);
    // A loop back into another surah reloads it asynchronously.
    await flush();
  }
  return heard;
}

/** Entries heard in one surah (as numbers). */
const inSurah = (heard: string[], surah: number) =>
  heard
    .filter(h => h.startsWith(`${surah}:`))
    .map(h => Number(h.split(':')[1]));

/** Loop one verse unit: Repeat as the verse sheet requests it. */
function repeatUnit(unit: AudioUnitInput) {
  st().setUnitRange(unit, unit);
  st().setVerseRepeatCount(0);
  st().setRangeRepeatCount(0);
}

beforeAll(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

beforeEach(() => {
  reset();
  mockPlayers.length = 0;
  mockUnitsUnavailable.clear();
  display('hafs');
  timingNumberingService.reset();
  (createAudioPlayer as jest.Mock).mockClear();
});

describe('Warsh mushaf, reciter numbered in Warsh (Warsh 14): one verse = one entry', () => {
  beforeEach(() => display('warsh'));

  it('the band moves at the Warsh verse ends, also inside Hafs 1:7', async () => {
    await play('warsh-14', 1, W('1:1'));
    expect(st().numberingMode).toBe('riwayah');
    for (const e of T('warsh-14', 1)) {
      at(e.timestampFrom + 50);
      expect(st().currentUnitKeys).toEqual([`1:${e.ayahNumber}`]);
      expect(st().currentUnitRewayah).toBe('warsh');
      expect(st().currentVerseLabel).toBe(`1:${e.ayahNumber}`);
      expect(parseVerseKeyListId(selectPlaybackUnitKeysId(st()))).toEqual([
        `1:${e.ayahNumber}`,
      ]);
    }
    // Warsh 1:6 and 1:7 are the two parts of Hafs 1:7: the Hafs keys (page
    // turns, Hafs-keyed painters) stay on the whole Hafs verse.
    at(entry('warsh-14', 1, 6).timestampFrom + 50);
    expect(st().currentUnitKeys).toEqual(['1:6']);
    expect(st().currentVerseKeys).toEqual(['1:7']);
    expect(selectPlaybackVerseKeysId(st())).toBe('1:7');
    expect(selectPlaybackUnitKeysId(st(), 'hafs')).toBe('1:7');
    at(entry('warsh-14', 1, 7).timestampFrom + 50);
    expect(st().currentUnitKeys).toEqual(['1:7']);
    expect(st().currentVerseKeys).toEqual(['1:7']);
    expect(formatPlaybackInfo('Al-Fatihah', st())).toBe('Al-Fatihah 1:7');
    expect(mushafLockScreenTitle(st(), () => 'Al-Fatihah')).toBe(
      'Al-Fatihah · 1:7',
    );
  });

  it('Repeat Warsh 1:6 loops Warsh 1:6 only (not all of Hafs 1:7)', async () => {
    repeatUnit(W('1:6'));
    await play('warsh-14', 1);
    expect(player().seeks).toEqual([seekOf('warsh-14', 1, 6)]);
    expect(inSurah(await listen(6), 1)).toEqual([6, 6, 6, 6, 6, 6]);
    expect(st().currentUnitKeys).toEqual(['1:6']);
    expect(st().playbackState).toBe('playing');
  });

  it('a Hafs-keyed Repeat of Hafs 1:7 still loops both Warsh verses (unchanged)', async () => {
    st().setRange({surah: 1, ayah: 7}, {surah: 1, ayah: 7});
    st().setVerseRepeatCount(0);
    st().setRangeRepeatCount(0);
    await play('warsh-14', 1, '1:7');
    expect(inSurah(await listen(6), 1)).toEqual([6, 7, 6, 7, 6, 7]);
  });

  it('Repeat Warsh 1:7 starts at Warsh 1:7 and loops it at the surah end', async () => {
    repeatUnit(W('1:7'));
    await play('warsh-14', 1, W('1:7'));
    expect(player().seeks).toEqual([seekOf('warsh-14', 1, 7)]);
    expect(inSurah(await listen(4), 1)).toEqual([7, 7, 7, 7]);
    expect(st().currentUnitKeys).toEqual(['1:7']);
  });

  it('a range Warsh 1:5 - 1:6 stops before Warsh 1:7', async () => {
    st().setUnitRange(W('1:5'), W('1:6'));
    await play('warsh-14', 1);
    expect(inSurah(await listen(), 1)).toEqual([5, 6]);
    expect(st().playbackState).toBe('idle');
    expect(st().currentUnitKeys).toEqual([]);
    expect(st().currentVerseLabel).toBeNull();
  });

  it('Play from Warsh 1:7 to the end of the surah plays Warsh 1:7 only', async () => {
    const surah1 = fixtureVerseUnits('warsh').unitsOfSurah(1);
    st().setUnitRange(W('1:7'), surah1[surah1.length - 1]);
    await play('warsh-14', 1, W('1:7'));
    expect(player().seeks).toEqual([seekOf('warsh-14', 1, 7)]);
    expect(await listen()).toEqual(['1:7']);
    expect(st().playbackState).toBe('idle');
  });

  it('per-verse and range repeat counts count Warsh verses', async () => {
    st().setUnitRange(W('1:5'), W('1:7'));
    st().setVerseRepeatCount(2);
    st().setRangeRepeatCount(2);
    await play('warsh-14', 1);
    expect(inSurah(await listen(), 1)).toEqual([
      5, 5, 6, 6, 7, 7, 5, 5, 6, 6, 7, 7,
    ]);
    expect(st().playbackState).toBe('idle');
  });

  it('a range across surahs (Warsh 1:7 - 2:1) ends with Warsh 2:1', async () => {
    // Warsh 2:1 = Hafs 2:1 + 2:2 (al-Baqarah is not in the units fixture)
    const warsh21: AudioUnitTarget = {
      rewayah: 'warsh',
      surah: 2,
      ayah: 1,
      key: '2:1',
      hafsFirstAyah: 1,
      hafsLastAyah: 2,
    };
    st().setUnitRange(W('1:7'), warsh21);
    await play('warsh-14', 1);
    expect(await listen()).toEqual(['1:7', '2:1']);
    expect(st().playbackState).toBe('idle');
  });

  it('a looped range across surahs restarts at its first Warsh verse', async () => {
    const warsh21: AudioUnitTarget = {
      rewayah: 'warsh',
      surah: 2,
      ayah: 1,
      key: '2:1',
      hafsFirstAyah: 1,
      hafsLastAyah: 2,
    };
    st().setUnitRange(W('1:7'), warsh21);
    st().setRangeRepeatCount(2);
    await play('warsh-14', 1);
    expect(await listen()).toEqual(['1:7', '2:1', '1:7', '2:1']);
    expect(mockPlayers.flatMap(p => p.seeks)).toEqual([
      seekOf('warsh-14', 1, 7),
      seekOf('warsh-14', 2, 1),
      seekOf('warsh-14', 1, 7),
      seekOf('warsh-14', 2, 1),
    ]);
    expect(st().playbackState).toBe('idle');
  });

  it('Warsh 106: Repeat of the first part of Hafs 106:4 loops it alone', async () => {
    repeatUnit(W('106:4'));
    await play('warsh-14', 604, W('106:4'));
    expect(inSurah(await listen(4), 106)).toEqual([4, 4, 4, 4]);
    expect(st().currentVerseKeys).toEqual(['106:4']);
    expect(st().currentUnitKeys).toEqual(['106:4']);
  });

  it('Warsh 107:6 (Hafs 107:6 + 107:7) is one entry and one band', async () => {
    repeatUnit(W('107:6'));
    await play('warsh-14', 602, W('107:6'));
    expect(st().currentVerseKeys).toEqual(['107:6', '107:7']);
    expect(st().currentUnitKeys).toEqual(['107:6']);
    expect(st().currentVerseLabel).toBe('107:6');
    expect(inSurah(await listen(3), 107)).toEqual([6, 6, 6]);
  });
});

describe('al-Bazzi mushaf, reciter numbered in al-Bazzi (al-Bazzi 296)', () => {
  beforeEach(() => display('al-bazzi'));

  it('lights al-Bazzi 112:3 and 112:4 one at a time (both in Hafs 112:3)', async () => {
    await play('bazzi-296', 604, B('112:1'));
    for (const e of T('bazzi-296', 112)) {
      at(e.timestampFrom + 50);
      expect(st().currentUnitKeys).toEqual([`112:${e.ayahNumber}`]);
      expect(st().currentVerseLabel).toBe(`112:${e.ayahNumber}`);
    }
    at(entry('bazzi-296', 112, 4).timestampFrom + 50);
    expect(st().currentVerseKeys).toEqual(['112:3']);
  });

  it('Repeat al-Bazzi 112:4 loops it alone; a range 112:3 - 112:3 stops before 112:4', async () => {
    repeatUnit(B('112:4'));
    await play('bazzi-296', 604);
    expect(player().seeks).toEqual([seekOf('bazzi-296', 112, 4)]);
    expect(inSurah(await listen(4), 112)).toEqual([4, 4, 4, 4]);

    reset();
    st().setUnitRange(B('112:3'), B('112:3'));
    await play('bazzi-296', 604);
    expect(inSurah(await listen(), 112)).toEqual([3]);
    expect(st().playbackState).toBe('idle');
  });
});

describe('Warsh mushaf, Hafs-numbered Warsh reciter (Warsh 134): safe mapping', () => {
  beforeEach(() => display('warsh'));

  it('an entry lights every Warsh verse it recites; the basmala lights none', async () => {
    await play('warsh-134', 1, '1:1');
    expect(st().numberingMode).toBe('hafs');
    at(entry('warsh-134', 1, 1).timestampFrom + 50);
    // Hafs 1:1, the basmala, is no verse in the Madani count
    expect(st().currentVerseKey).toBe('1:1');
    expect(st().currentUnitKeys).toEqual([]);
    expect(st().currentVerseLabel).toBeNull();
    expect(formatPlaybackInfo('Al-Fatihah', st())).toBe('Al-Fatihah');
    expect(mushafLockScreenTitle(st(), () => 'Al-Fatihah')).toBe('Al-Fatihah');
    at(entry('warsh-134', 1, 2).timestampFrom + 50);
    expect(st().currentUnitKeys).toEqual(['1:1']);
    expect(st().currentVerseLabel).toBe('1:1');
    at(entry('warsh-134', 1, 7).timestampFrom + 50);
    expect(st().currentUnitKeys).toEqual(['1:6', '1:7']);
    expect(st().currentVerseLabel).toBe('1:6-7');
  });

  it('Repeat Warsh 1:6 or 1:7 loops the whole Hafs 1:7 entry', async () => {
    for (const key of ['1:6', '1:7']) {
      reset();
      repeatUnit(W(key));
      await play('warsh-134', 1, W(key));
      expect(player().seeks).toEqual([seekOf('warsh-134', 1, 7)]);
      expect(inSurah(await listen(3), 1)).toEqual([7, 7, 7]);
    }
  });

  it('Repeat Warsh 107:6 loops both Hafs entries it holds (never half of it)', async () => {
    repeatUnit(W('107:6'));
    await play('warsh-134', 602, W('107:6'));
    expect(player().seeks).toEqual([seekOf('warsh-134', 107, 6)]);
    expect(inSurah(await listen(6), 107)).toEqual([6, 7, 6, 7, 6, 7]);
  });

  it('a range Warsh 106:5 - 106:5 plays the Hafs 106:4 entry once', async () => {
    st().setUnitRange(W('106:5'), W('106:5'));
    await play('warsh-134', 604);
    expect(inSurah(await listen(), 106)).toEqual([4]);
    expect(st().playbackState).toBe('idle');
  });

  it("Play on al-Fatihah's page still starts with the recited basmala", async () => {
    // The page's first word is in the unnumbered basmala: the page starts at
    // its first Hafs verse, the reciter's first entry, as before.
    mockPages[1] = {keys: ['1:1', '1:2'], firstWordId: 1};
    await play('warsh-134', 1);
    expect(player().seeks).toEqual([seekOf('warsh-134', 1, 1)]);
    expect(st().currentUnitKeys).toEqual([]);
  });
});

describe('al-Duri mushaf, Warsh-numbered reciter: another rewayah, safe mapping', () => {
  beforeEach(() => display('al-duri-abi-amr'));

  it('each Warsh entry of Hafs 1:7 lights both al-Duri parts of it', async () => {
    await play('warsh-14', 1, D('1:1'));
    expect(player().seeks).toEqual([seekOf('warsh-14', 1, 1)]);
    for (const ayah of [6, 7]) {
      at(entry('warsh-14', 1, ayah).timestampFrom + 50);
      expect(st().currentUnitKeys).toEqual(['1:6', '1:7']);
      expect(st().currentUnitRewayah).toBe('al-duri-abi-amr');
      expect(st().currentVerseLabel).toBe('1:6-7');
    }
  });

  it('Repeat al-Duri 1:7 loops both Warsh entries of Hafs 1:7', async () => {
    repeatUnit(D('1:7'));
    await play('warsh-14', 1, D('1:7'));
    expect(player().seeks).toEqual([seekOf('warsh-14', 1, 6)]);
    expect(inSurah(await listen(6), 1)).toEqual([6, 7, 6, 7, 6, 7]);
  });
});

describe('Hafs mushaf, Warsh-numbered reciter (Warsh 14): Hafs verses', () => {
  it('the band is the Hafs verse being recited', async () => {
    await play('warsh-14', 1, H('1:2'));
    at(entry('warsh-14', 1, 6).timestampFrom + 50);
    expect(st().currentUnitKeys).toEqual(['1:7']);
    expect(st().currentUnitRewayah).toBe('hafs');
    at(entry('warsh-14', 1, 7).timestampFrom + 50);
    expect(st().currentUnitKeys).toEqual(['1:7']);
    expect(st().currentVerseLabel).toBe('1:7');
    // A painter of the reciter's own rewayah gets exactly the entry's verse.
    expect(selectPlaybackUnitKeysId(st(), 'warsh')).toBe('1:7');
    at(entry('warsh-14', 1, 6).timestampFrom + 50);
    expect(selectPlaybackUnitKeysId(st(), 'warsh')).toBe('1:6');
    // ...and a painter of another rewayah every verse holding Hafs 1:7.
    expect(selectPlaybackUnitKeysId(st(), 'al-duri-abi-amr')).toBe('1:6|1:7');
  });

  it('Repeat Hafs 1:7 as a unit = Repeat Hafs 1:7 as a Hafs key (both Warsh verses)', async () => {
    const heard: number[][] = [];
    for (const useUnits of [false, true]) {
      reset();
      if (useUnits) repeatUnit(H('1:7'));
      else {
        st().setRange({surah: 1, ayah: 7}, {surah: 1, ayah: 7});
        st().setVerseRepeatCount(0);
        st().setRangeRepeatCount(0);
      }
      await play('warsh-14', 1, useUnits ? H('1:7') : '1:7');
      heard.push(inSurah(await listen(6), 1));
    }
    expect(heard[0]).toEqual([6, 7, 6, 7, 6, 7]);
    expect(heard[1]).toEqual(heard[0]);
  });

  it('the basmala (Hafs 1:1) as a unit starts at the reciter verse 1', async () => {
    st().setUnitRange(H('1:1'), H('1:1'));
    await play('warsh-14', 1);
    expect(player().seeks).toEqual([seekOf('warsh-14', 1, 1)]);
    expect(inSurah(await listen(), 1)).toEqual([1]);
    expect(st().playbackState).toBe('idle');
  });
});

describe('Hafs recitations: the unit API gives exactly what the Hafs API gives', () => {
  /** Everything observable about one playback request. */
  async function observe(
    set: string,
    page: number,
    setup: () => void,
    start: string | AudioUnitInput | undefined,
    steps: number,
  ) {
    reset();
    mockPlayers.length = 0;
    setup();
    const states: string[] = [];
    const unsubscribe = useMushafPlayerStore.subscribe(s => {
      states.push(
        JSON.stringify([
          s.playbackState,
          s.currentSurah,
          s.currentAyah,
          s.currentVerseKey,
          s.currentVerseKeys,
          s.currentReciterVerseKey,
          s.currentVerseLabel,
          s.numberingMode,
          s.timestampError,
          s.rangeStart,
          s.rangeEnd,
          selectPlaybackVerseKeysId(s),
        ]),
      );
    });
    await play(set, page, start);
    const seeks = mockPlayers.length ? [...player().seeks] : [];
    const heard = await listen(steps);
    unsubscribe();
    return {seeks, heard, states};
  }

  // set, surah, verse count, units from the Hafs words DB fixture?
  const cases: [string, number, number, boolean][] = [
    ['hafs-clean', 1, 7, true],
    ['hafs-clean', 112, 4, true],
    ['hafs-preroll', 112, 4, true],
    ['shubah-305', 1, 7, true],
    ['shubah-305', 112, 4, true],
    ['hafs-clean', 2, 286, false],
  ];

  it.each(cases)(
    '%s surah %i: Play to the end, Repeat and two-verse ranges of every verse',
    async (set, surah, count, fromFixture) => {
      const unitOf = (ayah: number): AudioUnitInput =>
        fromFixture ? H(`${surah}:${ayah}`) : hafsTarget(surah, ayah);
      const ayahs =
        count > 20 ? [1, 2, 3, 5, 30, 142, 255, 256, 285, 286] : null;
      for (let ayah = 1; ayah <= count; ayah++) {
        if (ayahs && !ayahs.includes(ayah)) continue;
        const steps = Math.min(count - ayah + 2, 12);
        // Play from the verse to the end of the surah
        const playHafs = await observe(
          set,
          1,
          () => st().setRange({surah, ayah}, {surah, ayah: count}),
          `${surah}:${ayah}`,
          steps,
        );
        const playUnits = await observe(
          set,
          1,
          () => st().setUnitRange(unitOf(ayah), unitOf(count)),
          unitOf(ayah),
          steps,
        );
        expect(playUnits).toEqual(playHafs);
        // Repeat the verse
        const loop = (units: boolean) => () => {
          if (units) st().setUnitRange(unitOf(ayah), unitOf(ayah));
          else st().setRange({surah, ayah}, {surah, ayah});
          st().setVerseRepeatCount(0);
          st().setRangeRepeatCount(0);
        };
        const repeatHafs = await observe(
          set,
          1,
          loop(false),
          `${surah}:${ayah}`,
          5,
        );
        const repeatUnits = await observe(set, 1, loop(true), unitOf(ayah), 5);
        expect(repeatUnits).toEqual(repeatHafs);
        // A two-verse range repeated twice, each verse twice
        if (ayah < count) {
          const twice = (units: boolean) => () => {
            if (units) st().setUnitRange(unitOf(ayah), unitOf(ayah + 1));
            else st().setRange({surah, ayah}, {surah, ayah: ayah + 1});
            st().setVerseRepeatCount(2);
            st().setRangeRepeatCount(2);
          };
          const rangeHafs = await observe(set, 1, twice(false), undefined, 12);
          const rangeUnits = await observe(set, 1, twice(true), undefined, 12);
          expect(rangeUnits).toEqual(rangeHafs);
        }
      }
    },
  );

  it('the band of a Hafs mushaf is the Hafs keys, with the historical label', async () => {
    for (const set of ['hafs-clean', 'warsh-14', 'warsh-134']) {
      reset();
      await play(set, 1, '1:1');
      for (const e of T(set, 1)) {
        at(e.timestampFrom + 50);
        expect(st().currentUnitKeys).toEqual(st().currentVerseKeys);
        expect(st().currentUnitRewayah).toBe('hafs');
        expect(selectPlaybackUnitKeysId(st())).toBe(
          selectPlaybackVerseKeysId(st()),
        );
      }
    }
    reset();
    await play('hafs-clean', 1, '1:1');
    for (const e of T('hafs-clean', 1)) {
      at(e.timestampFrom + 50);
      expect(st().currentVerseLabel).toBe(`1:${e.ayahNumber}`);
    }
  });

  it('Play with no start begins at the first Hafs verse of the page, as before', async () => {
    mockPages[1] = {keys: ['1:1', '1:2'], firstWordId: 1};
    mockPages[42] = {keys: ['2:253', '2:254'], firstWordId: 100};
    for (const page of [1, 42]) {
      reset();
      mockPlayers.length = 0;
      await play('hafs-clean', page);
      const first = mockPages[page].keys[0].split(':').map(Number);
      expect(player().seeks).toEqual([
        seekOf('hafs-clean', first[0], first[1]),
      ]);
    }
  });
});

describe('the mushaf on screen', () => {
  it('switching its rewayah renumbers the band and the label at once', async () => {
    display('warsh');
    await play('warsh-14', 1, W('1:6'));
    expect(st().currentUnitKeys).toEqual(['1:6']);
    expect(st().currentVerseLabel).toBe('1:6');
    act(() => display('hafs'));
    expect(st().currentUnitRewayah).toBe('hafs');
    expect(st().currentUnitKeys).toEqual(['1:7']);
    expect(st().currentVerseLabel).toBe('1:7');
    // also while paused
    mushafAudioService.pause();
    st().setPlaybackState('paused');
    act(() => display('warsh'));
    expect(st().currentUnitKeys).toEqual(['1:6']);
    expect(st().currentVerseLabel).toBe('1:6');
  });

  it('fails closed: no band and no number while its verse units are unavailable', async () => {
    mockUnitsUnavailable.add('warsh');
    display('warsh');
    await play('warsh-14', 1, W('1:6'));
    expect(player().seeks).toEqual([seekOf('warsh-14', 1, 6)]);
    expect(st().currentVerseKeys).toEqual(['1:7']); // page turns keep working
    expect(st().currentUnitKeys).toEqual([]);
    expect(st().currentVerseLabel).toBeNull();
    expect(formatPlaybackInfo('Al-Fatihah', st())).toBe('Al-Fatihah');
    expect(selectPlaybackUnitKeysId(st(), 'warsh')).toBe('');
    expect(selectPlaybackUnitKeysId(st(), 'hafs')).toBe('1:7');
  });

  it('the band and the label appear as soon as the verse units are ready', async () => {
    mockUnitsUnavailable.add('warsh');
    display('warsh');
    await play('warsh-14', 1, W('1:6'));
    expect(st().currentUnitKeys).toEqual([]);
    expect(mockUnitsListeners.size).toBeGreaterThan(0);
    mockUnitsUnavailable.delete('warsh');
    act(() => mockUnitsListeners.forEach(listener => listener()));
    expect(st().currentUnitKeys).toEqual(['1:6']);
    expect(st().currentVerseLabel).toBe('1:6');
    // ...and go when they are dropped
    mockUnitsUnavailable.add('warsh');
    act(() => mockUnitsListeners.forEach(listener => listener()));
    expect(st().currentUnitKeys).toEqual([]);
    expect(st().currentVerseLabel).toBeNull();
  });

  it('usePlaybackUnitKeys follows the band and re-renders only when it changes', async () => {
    display('warsh');
    await play('warsh-14', 1, W('1:5'));
    const seen: (readonly string[])[] = [];
    const seenHafs: (readonly string[])[] = [];
    function Probe() {
      seen.push(usePlaybackUnitKeys());
      seenHafs.push(usePlaybackUnitKeys('hafs'));
      return null;
    }
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(Probe) as Parameters<typeof TestRenderer.create>[0],
      );
    });
    expect(seen[seen.length - 1]).toEqual(['1:5']);
    expect(seenHafs[seenHafs.length - 1]).toEqual(['1:6']);
    const renders = seen.length;
    act(() => st().setRate(1.25)); // unrelated store update
    expect(seen.length).toBe(renders);
    act(() => at(entry('warsh-14', 1, 6).timestampFrom + 50));
    expect(seen[seen.length - 1]).toEqual(['1:6']);
    expect(seenHafs[seenHafs.length - 1]).toEqual(['1:7']);
    act(() => at(entry('warsh-14', 1, 7).timestampFrom + 50));
    expect(seen[seen.length - 1]).toEqual(['1:7']);
    expect(seenHafs[seenHafs.length - 1]).toEqual(['1:7']);
    act(() => st().stop());
    expect(seen[seen.length - 1]).toEqual([]);
    act(() => renderer?.unmount());
  });
});

describe('where playback starts', () => {
  it("Play with no start begins at the Warsh verse holding the page's first word", async () => {
    display('warsh');
    // Page 1 begins with the basmala, which is no Warsh verse: the page's
    // first Hafs verse (the Warsh-numbered set has no entry for it: verse 1).
    mockPages[1] = {keys: ['1:1', '1:2'], firstWordId: 1};
    await play('warsh-14', 1);
    expect(player().seeks).toEqual([seekOf('warsh-14', 1, 1)]);
    // A page that begins inside Warsh 1:7 (the second part of Hafs 1:7)
    // starts at Warsh 1:7, not with the start of Hafs 1:7.
    mockPages[9001] = {keys: ['1:7'], firstWordId: W('1:7').firstWordId + 1};
    reset();
    mockPlayers.length = 0;
    await play('warsh-14', 9001);
    expect(player().seeks).toEqual([seekOf('warsh-14', 1, 7)]);
  });

  it('a pending unit start is used once, with its Hafs verse for Hafs-keyed readers', async () => {
    display('warsh');
    st().setPendingStart(W('1:7'));
    expect(st().pendingStartUnit).toMatchObject({rewayah: 'warsh', key: '1:7'});
    expect(st().pendingStartVerseKey).toBe('1:7');
    await play('warsh-14', 1);
    expect(player().seeks).toEqual([seekOf('warsh-14', 1, 7)]);
    expect(st().pendingStartUnit).toBeNull();
    expect(st().pendingStartVerseKey).toBeNull();
  });

  it('a later Hafs-keyed pending start replaces a pending unit', async () => {
    display('warsh');
    st().setPendingStart(W('1:7'));
    // a Hafs-keyed caller writes the store directly
    useMushafPlayerStore.setState({pendingStartVerseKey: '1:5'});
    await play('warsh-14', 1);
    // Hafs 1:5 is Warsh 1:4
    expect(player().seeks).toEqual([seekOf('warsh-14', 1, 4)]);
  });

  it('setUnitRange keeps the Hafs envelope; setRange / clearRange / stop drop the units', () => {
    st().setUnitRange(W('1:6'), W('1:7'));
    expect(st().rangeStart).toEqual({surah: 1, ayah: 7});
    expect(st().rangeEnd).toEqual({surah: 1, ayah: 7});
    st().setUnitRange(W('103:1'), W('103:3'));
    expect(st().rangeStart).toEqual({surah: 103, ayah: 1});
    expect(st().rangeEnd).toEqual({surah: 103, ayah: 3});
    st().setRange({surah: 2, ayah: 5}, {surah: 2, ayah: 5});
    expect(st().rangeUnits).toBeNull();
    st().setUnitRange(W('1:6'), W('1:6'));
    st().clearRange();
    expect(st().rangeUnits).toBeNull();
    st().setUnitRange(W('1:6'), W('1:6'));
    st().stop();
    expect(st()).toMatchObject({
      rangeUnits: null,
      rangeStart: null,
      rangeEnd: null,
      currentUnitKeys: [],
      currentUnitRewayah: null,
    });
  });

  it('a range written over a unit range by a Hafs-keyed caller is used as written', async () => {
    display('warsh');
    st().setUnitRange(W('1:6'), W('1:6'));
    useMushafPlayerStore.setState({
      rangeStart: {surah: 1, ayah: 2},
      rangeEnd: {surah: 1, ayah: 3},
    });
    await play('warsh-14', 1);
    // Hafs 1:2 - 1:3 is Warsh 1:1 - 1:2
    expect(inSurah(await listen(), 1)).toEqual([1, 2]);
  });

  it('refuses a range that mixes two numberings', () => {
    expect(() => st().setUnitRange(W('1:6'), B('112:4'))).toThrow(
      /mixes two numberings/,
    );
    expect(st().rangeUnits).toBeNull();
  });

  it('a reversed range plays its start verse only, as a Hafs range does', async () => {
    display('warsh');
    st().setUnitRange(W('1:7'), W('1:6'));
    await play('warsh-14', 1);
    expect(inSurah(await listen(), 1)).toEqual([7]);
    expect(st().playbackState).toBe('idle');
  });
});
