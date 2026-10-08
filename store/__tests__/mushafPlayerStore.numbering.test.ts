/**
 * Mushaf player with rewayah-numbered timings.
 *
 * Drives the real store/mushafPlayerStore.ts + services/audio/MushafAudioService.ts
 * against real R2 timing files (services/timestamps/__fixtures__) with a fake
 * expo-audio player, and checks what is highlighted, where playback starts,
 * what a repeat loops and where a range stops. Expected Hafs verses come from
 * an alignment of the KFGQPC text that is independent of the verse maps.
 *
 * Reproduces the audit's failing cases (al-Baqarah follow-along, Repeat 2:5,
 * range 2:30-2:37, Play from 2:286, al-Bazzi 112:5) and proves Hafs and
 * Hafs-numbered sets keep the identity behaviour.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {AyahTimestamp} from '@/types/timestamps';

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
const mockDisplay = {rewayah: 'hafs'};
const mockPageKeys: Record<number, string[]> = {};

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
    getOrderedVerseKeysForPage: (page: number) => mockPageKeys[page] ?? [],
  },
}));

jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: {getState: () => mockDisplay},
}));

// @ai-start
// The mushaf's verse units are ready (the label may use its own numbering);
// these tests use no page starts by verse unit.
jest.mock('@/utils/playbackVerseUnits', () => ({
  readyVerseUnits: () => null,
  canShowRewayahVerses: () => true,
  subscribeVerseUnitsChanges: () => () => undefined,
}));
// @ai-end

import {
  useMushafPlayerStore,
  isVerseKeyPlaying,
  selectPlaybackVerseKeys,
  VERSE_TIMING_UNAVAILABLE_ERROR,
  // @ai-start
  RANGE_UNPLAYABLE_ERROR,
  TIMESTAMPS_UNAVAILABLE_ERROR,
  formatPlaybackInfo,
  getPlaybackNotice,
  getPlayerBarNotice,
  selectPlaybackVerseKeysId,
  usePlaybackVerseKeys,
  // @ai-end
} from '../mushafPlayerStore';
import {parseVerseKeyListId} from '@/utils/timestampNumbering'; // @ai
import {mushafAudioService} from '@/services/audio/MushafAudioService';
import {
  SET_CLASS_VOTE_TIMEOUT_MS, // @ai
  timingNumberingService,
} from '@/services/timestamps/TimingNumberingService';
import {
  loadTimings,
  oracleHafsAyahs,
} from '@/services/timestamps/__fixtures__/timingFixtures';
import {createAudioPlayer} from 'expo-audio';
import {timestampService} from '@/services/timestamps/TimestampService'; // @ai

// Hafs pages as laid out in the mushaf (first verse keys only matter here)
Object.assign(mockPageKeys, {
  1: ['1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7'],
  2: ['2:1', '2:2', '2:3', '2:4', '2:5'],
  562: ['67:1', '67:2', '67:3', '67:4', '67:5', '67:6', '67:7', '67:8'],
  604: ['112:1', '112:2', '112:3', '112:4'],
});

const st = () => useMushafPlayerStore.getState();
const player = () => mockPlayers[mockPlayers.length - 1];

function T(set: string, surah: number): AyahTimestamp[] {
  const t = loadTimings(set, surah);
  if (!t) throw new Error(`missing fixture ${set}/${surah}`);
  return t;
}

const entry = (set: string, surah: number, ayah: number) =>
  T(set, surah).find(e => e.ayahNumber === ayah)!;

/** Move the playhead and let MushafAudioService's 200 ms poll run. */
function at(ms: number) {
  player().currentTime = ms / 1000;
  jest.advanceTimersByTime(200);
}

async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

async function play(set: string, page: number, key?: string) {
  st().setReciter(set, 'Test Reciter');
  await st().startPlayback(page, key);
}

function reset() {
  st().stop();
  st().setVerseRepeatCount(1);
  st().setRangeRepeatCount(1);
  st().clearRange();
  useMushafPlayerStore.setState({pendingStartVerseKey: null});
}

/**
 * Let the audio run forward entry by entry (finishing the surah at its last
 * entry) and return the timing entries actually heard, in order.
 */
async function listen(set: string, surah: number, maxSteps = 400) {
  const heard: number[] = [];
  for (let i = 0; i < maxSteps && st().playbackState !== 'idle'; i++) {
    const timings = mushafAudioService.getTimestamps();
    if (timings.length === 0) break;
    const pos = player().currentTime * 1000;
    let idx = -1;
    for (let k = 0; k < timings.length; k++) {
      if (timings[k].timestampFrom <= pos) idx = k;
    }
    if (idx >= 0) heard.push(timings[idx].ayahNumber);
    if (idx === timings.length - 1) {
      const p = player();
      p.listeners.forEach(l => l({didJustFinish: true}));
      await flush();
      if (mushafAudioService.getCurrentSurah() !== surah) break;
      continue;
    }
    at(timings[idx + 1].timestampFrom + 50);
  }
  return heard;
}

const warshHafs = (surah: number, entryAyah: number) =>
  oracleHafsAyahs('warsh', surah, entryAyah).map(a => `${surah}:${a}`);

beforeAll(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

beforeEach(() => {
  reset();
  mockPlayers.length = 0;
  mockDisplay.rewayah = 'hafs';
  timingNumberingService.reset();
  (createAudioPlayer as jest.Mock).mockClear();
});

// @ai-start
const getTimestampsForSurah =
  timestampService.getTimestampsForSurah as jest.Mock;
const fixtureTimings = getTimestampsForSurah.getMockImplementation()!;

/** Serve `files` (by `${set}-${surah}`) in place of the fixtures. */
function serveTimings(files: Partial<Record<string, AyahTimestamp[]>>) {
  getTimestampsForSurah.mockImplementation(
    async (set: string, surah: number) =>
      files[`${set}-${surah}`] ?? fixtureTimings(set, surah),
  );
}

afterEach(() => {
  getTimestampsForSurah.mockImplementation(fixtureTimings);
});
// @ai-end

describe('Warsh (rewayah-numbered set 14)', () => {
  it('follow-along in al-Baqarah highlights exactly the Hafs verses being recited', async () => {
    await play('warsh-14', 2);
    const timings = T('warsh-14', 2);
    expect(player().seeks).toEqual([timings[0].timestampFrom / 1000]);
    expect(st().numberingMode).toBe('riwayah');

    const highlighted = new Set<string>();
    for (const e of timings) {
      at(e.timestampFrom + 50);
      const expected = warshHafs(2, e.ayahNumber);
      expect(st().currentVerseKeys).toEqual(expected);
      // page turns follow the first Hafs verse the reciter is reciting
      expect(st().currentVerseKey).toBe(expected[0]);
      expect(st().currentAyah).toBe(Number(expected[0].split(':')[1]));
      expect(st().currentReciterVerseKey).toBe(`2:${e.ayahNumber}`);
      expected.forEach(k => highlighted.add(k));
    }
    // every Hafs verse of al-Baqarah is highlighted, including 2:286
    expect(highlighted.size).toBe(286);
    expect(highlighted.has('2:286')).toBe(true);
  });

  it('Warsh 2:1 highlights Hafs 2:1 and 2:2; Ayat al-Kursi spans two entries', async () => {
    await play('warsh-14', 2);
    at(entry('warsh-14', 2, 1).timestampFrom + 50);
    expect(st().currentVerseKeys).toEqual(['2:1', '2:2']);
    expect(isVerseKeyPlaying(st(), '2:2')).toBe(true);
    expect(selectPlaybackVerseKeys(st())).toEqual(['2:1', '2:2']);
    at(entry('warsh-14', 2, 253).timestampFrom + 50);
    expect(st().currentVerseKeys).toEqual(['2:255']);
    at(entry('warsh-14', 2, 254).timestampFrom + 50);
    expect(st().currentVerseKeys).toEqual(['2:255']);
  });

  it('Play from 2:286 starts at the reciter verse that recites it (no restart)', async () => {
    st().setRange({surah: 2, ayah: 286}, {surah: 2, ayah: 286});
    await play('warsh-14', 49, '2:286');
    const e285 = entry('warsh-14', 2, 285);
    expect(player().seeks).toEqual([e285.timestampFrom / 1000]);
    expect(st().currentVerseKey).toBe('2:286');
    at(e285.timestampFrom + 50);
    expect(st().currentVerseKey).toBe('2:286');
    expect(st().playbackState).toBe('playing');
    const heard = await listen('warsh-14', 2);
    expect(heard).toEqual([285]);
    expect(st().playbackState).toBe('idle');
  });

  it('Repeat 2:5 loops the Warsh verse that recites Hafs 2:5', async () => {
    st().setRange({surah: 2, ayah: 5}, {surah: 2, ayah: 5});
    st().setVerseRepeatCount(0);
    st().setRangeRepeatCount(0);
    await play('warsh-14', 2, '2:5');
    const e4 = entry('warsh-14', 2, 4);
    const e5 = entry('warsh-14', 2, 5);
    expect(player().seeks).toEqual([e4.timestampFrom / 1000]);
    expect(st().currentVerseKeys).toEqual(['2:5']);
    for (let i = 0; i < 3; i++) {
      at(e5.timestampFrom + 50);
      expect(player().currentTime).toBe(e4.timestampFrom / 1000);
      expect(st().currentVerseKeys).toEqual(['2:5']);
      expect(st().playbackState).toBe('playing');
    }
  });

  it('Repeat 2:255 loops both Warsh verses of Ayat al-Kursi without cutting it', async () => {
    st().setRange({surah: 2, ayah: 255}, {surah: 2, ayah: 255});
    st().setVerseRepeatCount(0);
    st().setRangeRepeatCount(0);
    await play('warsh-14', 42, '2:255');
    const e253 = entry('warsh-14', 2, 253);
    expect(player().seeks).toEqual([e253.timestampFrom / 1000]);
    const heard = await listen('warsh-14', 2, 9);
    expect(heard).toEqual([253, 254, 253, 254, 253, 254, 253, 254, 253]);
  });

  it('Repeat 2:1 loops Warsh 2:1 (Hafs 2:1 + 2:2)', async () => {
    st().setRange({surah: 2, ayah: 1}, {surah: 2, ayah: 1});
    st().setVerseRepeatCount(0);
    st().setRangeRepeatCount(0);
    await play('warsh-14', 2, '2:1');
    const heard = await listen('warsh-14', 2, 4);
    expect(heard).toEqual([1, 1, 1, 1]);
    expect(st().currentVerseKeys).toEqual(['2:1', '2:2']);
  });

  it('range 2:30-2:37 plays exactly Hafs 2:30..2:37 and stops', async () => {
    st().setRange({surah: 2, ayah: 30}, {surah: 2, ayah: 37});
    await play('warsh-14', 5, '2:30');
    const heard = await listen('warsh-14', 2);
    const hafs = heard.flatMap(a => warshHafs(2, a));
    expect(hafs).toEqual([
      '2:30',
      '2:31',
      '2:32',
      '2:33',
      '2:34',
      '2:35',
      '2:36',
      '2:37',
    ]);
    expect(st().playbackState).toBe('idle');
    expect(st().currentVerseKey).toBeNull();
  });

  it('range repeat and per-verse repeat run in whole reciter verses', async () => {
    // Hafs 2:1-2:5 = Warsh 2:1-2:4; each verse twice, the range twice
    st().setRange({surah: 2, ayah: 1}, {surah: 2, ayah: 5});
    st().setVerseRepeatCount(2);
    st().setRangeRepeatCount(2);
    await play('warsh-14', 2, '2:1');
    const heard = await listen('warsh-14', 2);
    expect(heard).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(st().playbackState).toBe('idle');
  });

  it('al-Fatihah: equal counts, different boundaries, resolved by the set vote', async () => {
    await play('warsh-14', 1, '1:1');
    // the basmala is not a Madani verse: playback starts at Warsh 1:1 (Hafs 1:2)
    expect(player().seeks).toEqual([
      entry('warsh-14', 1, 1).timestampFrom / 1000,
    ]);
    expect(st().currentVerseKeys).toEqual(['1:2']);
    at(entry('warsh-14', 1, 6).timestampFrom + 50);
    expect(st().currentVerseKeys).toEqual(['1:7']);
    at(entry('warsh-14', 1, 7).timestampFrom + 50);
    expect(st().currentVerseKeys).toEqual(['1:7']);
  });

  it('advances into the next surah with the right numbering', async () => {
    await play('warsh-14', 1, '1:7');
    const heard = await listen('warsh-14', 1);
    expect(heard).toEqual([6, 7]);
    await flush();
    expect(st().currentSurah).toBe(2);
    expect(st().playbackState).toBe('playing');
    expect(player().seeks).toEqual([
      entry('warsh-14', 2, 1).timestampFrom / 1000,
    ]);
    expect(st().currentVerseKeys).toEqual(['2:1', '2:2']);
  });

  it('labels the verse in the numbering of the mushaf on screen', async () => {
    await play('warsh-14', 2);
    mockDisplay.rewayah = 'warsh';
    at(entry('warsh-14', 2, 4).timestampFrom + 50);
    expect(st().currentVerseLabel).toBe('2:4');
    mockDisplay.rewayah = 'hafs';
    at(entry('warsh-14', 2, 5).timestampFrom + 50);
    expect(st().currentVerseLabel).toBe('2:6');
    at(entry('warsh-14', 2, 1).timestampFrom + 50);
    expect(st().currentVerseLabel).toBe('2:1-2');
  });
});

describe('al-Bazzi (rewayah-numbered set 296)', () => {
  it('Play from 112:1 to the end of the surah plays all five Makki verses', async () => {
    // VerseActionsSheet "Play": range end = Hafs verse count (4)
    st().setRange({surah: 112, ayah: 1}, {surah: 112, ayah: 4});
    await play('bazzi-296', 604, '112:1');
    const keys: string[][] = [];
    const unsubscribe = useMushafPlayerStore.subscribe(s => {
      if (s.currentVerseKeys.length) keys.push([...s.currentVerseKeys]);
    });
    const heard = await listen('bazzi-296', 112);
    unsubscribe();
    expect(heard).toEqual([1, 2, 3, 4, 5]);
    expect(keys.flat()).not.toContain('112:5');
    expect(keys).toContainEqual(['112:4']);
    expect(st().playbackState).toBe('idle');
  });

  it('entry 4 ("wa lam yulad") highlights Hafs 112:3', async () => {
    await play('bazzi-296', 604, '112:1');
    at(entry('bazzi-296', 112, 4).timestampFrom + 50);
    expect(st().currentVerseKeys).toEqual(['112:3']);
    at(entry('bazzi-296', 112, 5).timestampFrom + 50);
    expect(st().currentVerseKeys).toEqual(['112:4']);
  });
});

describe('al-Duri set 269, al-Mulk (count matches neither system)', () => {
  it('plays without any highlight or verse seeking', async () => {
    await play('doori-269', 562, '67:5');
    expect(st().numberingMode).toBe('disabled');
    expect(st().playbackState).toBe('playing');
    expect(player().seeks).toEqual([]); // from the start, no guessed verse
    for (const e of T('doori-269', 67)) {
      at(e.timestampFrom + 50);
      expect(st().currentVerseKey).toBeNull();
      expect(st().currentVerseKeys).toEqual([]);
      expect(st().currentVerseLabel).toBeNull();
    }
    const seeks = player().seeks.length;
    mushafAudioService.seekToNextAyah();
    mushafAudioService.seekToPreviousAyah();
    expect(player().seeks.length).toBe(seeks);
  });

  it('refuses a repeat it cannot honour', async () => {
    st().setRange({surah: 67, ayah: 5}, {surah: 67, ayah: 5});
    st().setVerseRepeatCount(0);
    st().setRangeRepeatCount(0);
    await play('doori-269', 562, '67:5');
    expect(st().playbackState).toBe('idle');
    expect(st().timestampError).toBe(VERSE_TIMING_UNAVAILABLE_ERROR);
    expect(createAudioPlayer).not.toHaveBeenCalled();
  });
});

describe('Hafs-numbered non-Hafs sets keep the identity mapping', () => {
  it('Warsh set 134 (Hafs-numbered): every entry N highlights Hafs 2:N', async () => {
    await play('warsh-134', 2);
    expect(st().numberingMode).toBe('hafs');
    const timings = T('warsh-134', 2);
    expect(timings).toHaveLength(286);
    for (const e of timings) {
      at(e.timestampFrom + 50);
      expect(st().currentVerseKeys).toEqual([`2:${e.ayahNumber}`]);
    }
  });

  it('Warsh set 134, al-Fatihah: the set vote keeps it Hafs-numbered', async () => {
    await play('warsh-134', 1, '1:1');
    expect(st().numberingMode).toBe('hafs');
    expect(player().seeks).toEqual([
      entry('warsh-134', 1, 1).timestampFrom / 1000,
    ]);
    expect(st().currentVerseKeys).toEqual(['1:1']);
  });

  it("Shu'bah set 305 is identity", async () => {
    await play('shubah-305', 2);
    for (const e of T('shubah-305', 2)) {
      at(e.timestampFrom + 50);
      expect(st().currentVerseKey).toBe(`2:${e.ayahNumber}`);
    }
  });
});

describe('Hafs recitations are unchanged', () => {
  it('follow-along: entry N highlights 2:N', async () => {
    await play('hafs-clean', 2);
    expect(st().numberingMode).toBe('hafs');
    for (const e of T('hafs-clean', 2)) {
      at(e.timestampFrom + 50);
      expect(st().currentVerseKey).toBe(`2:${e.ayahNumber}`);
      expect(st().currentVerseKeys).toEqual([`2:${e.ayahNumber}`]);
      expect(st().currentAyah).toBe(e.ayahNumber);
      expect(st().currentVerseLabel).toBe(`2:${e.ayahNumber}`);
    }
  });

  it('Repeat 2:5 loops entry 5', async () => {
    st().setRange({surah: 2, ayah: 5}, {surah: 2, ayah: 5});
    st().setVerseRepeatCount(0);
    st().setRangeRepeatCount(0);
    await play('hafs-clean', 2, '2:5');
    expect(player().seeks).toEqual([
      entry('hafs-clean', 2, 5).timestampFrom / 1000,
    ]);
    const heard = await listen('hafs-clean', 2, 4);
    expect(heard).toEqual([5, 5, 5, 5]);
  });

  it('range 2:30-2:37 plays entries 30..37', async () => {
    st().setRange({surah: 2, ayah: 30}, {surah: 2, ayah: 37});
    await play('hafs-clean', 5, '2:30');
    const heard = await listen('hafs-clean', 2);
    expect(heard).toEqual([30, 31, 32, 33, 34, 35, 36, 37]);
  });

  it('Play from 2:286 seeks to entry 286', async () => {
    st().setRange({surah: 2, ayah: 286}, {surah: 2, ayah: 286});
    await play('hafs-clean', 49, '2:286');
    expect(player().seeks).toEqual([
      entry('hafs-clean', 2, 286).timestampFrom / 1000,
    ]);
    expect(st().currentVerseKey).toBe('2:286');
  });

  it('an ayah-0 pre-roll entry still reports s:0 as before', async () => {
    await play('hafs-preroll', 604, '112:1');
    expect(player().seeks).toEqual([
      entry('hafs-preroll', 112, 1).timestampFrom / 1000,
    ]);
    at(50);
    expect(st().currentVerseKey).toBe('112:0');
    expect(st().currentAyah).toBe(0);
  });

  it('prev / next ayah still step through entries', async () => {
    await play('hafs-clean', 2, '2:10');
    mushafAudioService.seekToNextAyah();
    expect(st().currentVerseKey).toBe('2:11');
    mushafAudioService.seekToPreviousAyah();
    mushafAudioService.seekToPreviousAyah();
    expect(st().currentVerseKey).toBe('2:9');
  });
});

describe('playback requests', () => {
  it('a superseded start does not load audio', async () => {
    st().setReciter('warsh-14', 'Test Reciter');
    const pending = st().startPlayback(2);
    st().stop();
    await pending;
    expect(createAudioPlayer).not.toHaveBeenCalled();
    expect(st().playbackState).toBe('idle');
  });

  it('stop clears every follow-along field', async () => {
    await play('warsh-14', 2);
    st().stop();
    expect(st()).toMatchObject({
      playbackState: 'idle',
      currentVerseKey: null,
      currentVerseKeys: [],
      currentReciterVerseKey: null,
      currentVerseLabel: null,
      numberingMode: null,
      _numbering: null,
      _entryAyah: 0,
    });
  });
});

// @ai-start
declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Records every store update that claims 'playing' while no audio player
 * exists (the "playing with no audio" state).
 */
function watchSilentPlaying() {
  const violations: (string | null)[] = [];
  const unsubscribe = useMushafPlayerStore.subscribe(s => {
    if (s.playbackState === 'playing' && !mushafAudioService.hasPlayer()) {
      violations.push(s.currentVerseKey);
    }
  });
  return {violations, unsubscribe};
}

describe('Fatiha basmala (Hafs 1:1) with a Madani-numbered reciter', () => {
  // The basmala is not a verse in the Madani count (Warsh 1:1 = Hafs 1:2):
  // every range / repeat unit resolves to the nearest real reciter verse.

  it('a range 1:1-1:1 plays the reciter verse 1 once, then stops', async () => {
    st().setRange({surah: 1, ayah: 1}, {surah: 1, ayah: 1});
    const watch = watchSilentPlaying();
    await play('warsh-14', 1, '1:1');
    expect(st().playbackState).toBe('playing');
    expect(player().playing).toBe(true);
    expect(player().seeks).toEqual([
      entry('warsh-14', 1, 1).timestampFrom / 1000,
    ]);
    expect(st().currentVerseKeys).toEqual(['1:2']);
    const heard = await listen('warsh-14', 1);
    expect(heard).toEqual([1]);
    expect(st().playbackState).toBe('idle');
    expect(st().timestampError).toBeNull();
    watch.unsubscribe();
    expect(watch.violations).toEqual([]);
  });

  it('Repeat 1:1 loops the reciter verse 1 with real audio', async () => {
    st().setRange({surah: 1, ayah: 1}, {surah: 1, ayah: 1});
    st().setVerseRepeatCount(0);
    st().setRangeRepeatCount(0);
    const watch = watchSilentPlaying();
    await play('warsh-14', 1, '1:1');
    const heard = await listen('warsh-14', 1, 4);
    expect(heard).toEqual([1, 1, 1, 1]);
    expect(st().playbackState).toBe('playing');
    expect(player().playing).toBe(true);
    expect(st().currentVerseKeys).toEqual(['1:2']);
    watch.unsubscribe();
    expect(watch.violations).toEqual([]);
  });

  it('a range 1:1-1:3 plays Hafs 1:2 and 1:3 (reciter verses 1-2)', async () => {
    st().setRange({surah: 1, ayah: 1}, {surah: 1, ayah: 3});
    await play('warsh-14', 1, '1:1');
    const heard = await listen('warsh-14', 1);
    expect(heard).toEqual([1, 2]);
    expect(heard.flatMap(a => warshHafs(1, a))).toEqual(['1:2', '1:3']);
    expect(st().playbackState).toBe('idle');
  });

  it('Hafs: a range 1:1-1:1 still plays entry 1 once', async () => {
    st().setRange({surah: 1, ayah: 1}, {surah: 1, ayah: 1});
    await play('hafs-clean', 1, '1:1');
    expect(st().currentVerseKeys).toEqual(['1:1']);
    const heard = await listen('hafs-clean', 1);
    expect(heard).toEqual([1]);
    expect(st().playbackState).toBe('idle');
  });
});

describe('a range that ends before it starts', () => {
  it('reports it instead of claiming to play with no audio', async () => {
    // Not reachable from the range pickers (they keep end >= start); this
    // pins the guard: the engine used to release the player inside the
    // first seek and then still set 'playing'.
    st().setRange({surah: 2, ayah: 10}, {surah: 2, ayah: 5});
    const watch = watchSilentPlaying();
    await play('hafs-clean', 2, '2:10');
    watch.unsubscribe();
    expect(st().playbackState).toBe('idle');
    expect(st().timestampError).toBe(RANGE_UNPLAYABLE_ERROR);
    expect(st().currentVerseKey).toBeNull();
    expect(watch.violations).toEqual([]);
  });
});

describe('highlight keys for the renderers', () => {
  it('selectPlaybackVerseKeysId lists every recited Hafs verse while not idle', async () => {
    expect(selectPlaybackVerseKeysId(st())).toBe('');
    await play('warsh-14', 2);
    at(entry('warsh-14', 2, 1).timestampFrom + 50);
    expect(parseVerseKeyListId(selectPlaybackVerseKeysId(st()))).toEqual([
      '2:1',
      '2:2',
    ]);
    // page modes keep the highlight while paused
    st().setPlaybackState('paused');
    expect(parseVerseKeyListId(selectPlaybackVerseKeysId(st()))).toEqual([
      '2:1',
      '2:2',
    ]);
    st().stop();
    expect(selectPlaybackVerseKeysId(st())).toBe('');
  });

  it('Hafs: the id is exactly currentVerseKey (single verse)', async () => {
    await play('hafs-clean', 2);
    for (const e of T('hafs-clean', 2).slice(0, 20)) {
      at(e.timestampFrom + 50);
      expect(selectPlaybackVerseKeysId(st())).toBe(st().currentVerseKey);
    }
  });

  it('usePlaybackVerseKeys re-renders only when the recited verses change', async () => {
    await play('warsh-14', 2);
    at(entry('warsh-14', 2, 1).timestampFrom + 50);
    const seen: (readonly string[])[] = [];
    function Probe() {
      seen.push(usePlaybackVerseKeys());
      return null;
    }
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(Probe) as Parameters<typeof TestRenderer.create>[0],
      );
    });
    expect(seen[seen.length - 1]).toEqual(['2:1', '2:2']);
    const renders = seen.length;
    act(() => st().setRate(1.25)); // unrelated store update
    expect(seen.length).toBe(renders);
    act(() => at(entry('warsh-14', 2, 2).timestampFrom + 50)); // Hafs 2:3
    expect(seen[seen.length - 1]).toEqual(['2:3']);
    act(() => st().stop());
    expect(seen[seen.length - 1]).toEqual([]);
    act(() => renderer?.unmount());
  });
});

describe('player info text and notices', () => {
  it('formats the verse in the numbering of the mushaf on screen', () => {
    expect(
      formatPlaybackInfo('Al-Baqarah', {
        currentVerseLabel: '2:4',
        numberingMode: 'riwayah',
      }),
    ).toBe('Al-Baqarah 2:4');
    expect(
      formatPlaybackInfo('Al-Mulk', {
        currentVerseLabel: null,
        numberingMode: 'disabled',
      }),
    ).toBe('Al-Mulk · Verse tracking unavailable');
    // no verse yet: the surah alone (never "2:0")
    expect(
      formatPlaybackInfo('Al-Baqarah', {
        currentVerseLabel: null,
        numberingMode: 'hafs',
      }),
    ).toBe('Al-Baqarah');
  });

  it('Hafs: the text is "<surah> <surah>:<ayah>" as before', async () => {
    await play('hafs-clean', 2, '2:5');
    expect(formatPlaybackInfo('Al-Baqarah', st())).toBe('Al-Baqarah 2:5');
  });

  const base = {
    playbackState: 'idle' as const,
    timestampError: null,
    numberingMode: null,
    currentSurah: 0,
  };
  const names = (n: number) => (n === 67 ? 'Al-Mulk' : '');

  it('notices a refused request once per refusal', () => {
    const refused = {...base, timestampError: VERSE_TIMING_UNAVAILABLE_ERROR};
    expect(getPlaybackNotice(base, refused, names)).toEqual({
      title: 'Playback unavailable',
      message: VERSE_TIMING_UNAVAILABLE_ERROR,
      preset: 'error',
    });
    expect(getPlaybackNotice(refused, refused, names)).toBeNull();
    expect(
      getPlaybackNotice(
        refused,
        {...base, timestampError: TIMESTAMPS_UNAVAILABLE_ERROR},
        names,
      )?.message,
    ).toBe(TIMESTAMPS_UNAVAILABLE_ERROR);
  });

  it('notices a surah that plays without verse tracking, once', () => {
    const loading = {
      ...base,
      playbackState: 'loading' as const,
      numberingMode: 'disabled' as const,
      currentSurah: 67,
    };
    const notice = getPlaybackNotice(base, loading, names);
    expect(notice?.title).toBe('Verse tracking unavailable');
    expect(notice?.message).toContain('Al-Mulk');
    const playing = {...loading, playbackState: 'playing' as const};
    expect(getPlaybackNotice(loading, playing, names)).toBeNull();
    // tracked surahs never notice anything
    const tracked = {...playing, numberingMode: 'hafs' as const};
    expect(getPlaybackNotice(base, tracked, names)).toBeNull();
  });

  it('the store emits the notices the toolbar shows', async () => {
    const notices: string[] = [];
    const unsubscribe = useMushafPlayerStore.subscribe((s, prev) => {
      const n = getPlaybackNotice(prev, s, names);
      if (n) notices.push(n.title);
    });
    await play('doori-269', 562, '67:5');
    st().stop();
    st().setRange({surah: 67, ayah: 5}, {surah: 67, ayah: 5});
    st().setVerseRepeatCount(0);
    await play('doori-269', 562, '67:5');
    await play('hafs-clean', 2, '2:5');
    unsubscribe();
    expect(notices).toEqual([
      'Verse tracking unavailable',
      'Playback unavailable',
    ]);
  });

  /** Messages of the notices the store emits while `run` runs. */
  async function noticesDuring(run: () => Promise<void>) {
    const messages: string[] = [];
    const barMessages: string[] = [];
    const unsubscribe = useMushafPlayerStore.subscribe((s, prev) => {
      const n = getPlaybackNotice(prev, s, names);
      if (n) messages.push(n.message);
      const b = getPlayerBarNotice(prev, s, names);
      if (b) barMessages.push(b.message);
    });
    await run();
    unsubscribe();
    return {messages, barMessages};
  }

  it('a requested verse a surah without verse tracking cannot start at: says it plays from the beginning', async () => {
    const {messages, barMessages} = await noticesDuring(() =>
      play('doori-269', 562, '67:5'),
    );
    // plain playback from the start of the audio, nothing highlighted
    expect(st().playbackState).toBe('playing');
    expect(player().seeks).toEqual([]);
    expect(st().ignoredStartVerseKey).toBe('67:5');
    const expected =
      'Al-Mulk plays from the beginning without verse tracking for this reciter.';
    expect(messages).toEqual([expected]);
    // the player bar shows "Verse tracking unavailable" inline, not this
    expect(barMessages).toEqual([expected]);
  });

  it("the page's first verse counts as a requested start too", async () => {
    mockPageKeys[563] = ['67:13', '67:14'];
    const {messages} = await noticesDuring(async () => {
      st().setReciter('doori-269', 'Test Reciter');
      await st().startPlayback(563);
    });
    expect(messages).toEqual([
      'Al-Mulk plays from the beginning without verse tracking for this reciter.',
    ]);
  });

  it('starting at the first verse: nothing was skipped, the notice is unchanged', async () => {
    const {messages, barMessages} = await noticesDuring(() =>
      play('doori-269', 562, '67:1'),
    );
    expect(st().ignoredStartVerseKey).toBeNull();
    expect(messages).toEqual([
      'Al-Mulk plays without verse highlighting for this reciter.',
    ]);
    expect(barMessages).toEqual([]);
  });

  it('a new start at a later verse of the surah already playing untracked says so again', async () => {
    await play('doori-269', 562, '67:1');
    expect(st().numberingMode).toBe('disabled');
    // the repeat options sheet: a range without repeats, started without stop
    const {messages, barMessages} = await noticesDuring(async () => {
      st().setRange({surah: 67, ayah: 10}, {surah: 67, ayah: 12});
      await st().startPlayback(562, '67:10');
    });
    expect(st().ignoredStartVerseKey).toBe('67:10');
    const expected =
      'Al-Mulk plays from the beginning without verse tracking for this reciter.';
    expect(messages).toEqual([expected]);
    expect(barMessages).toEqual([expected]);
  });

  it('Play after a range ended in the untracked surah says so again', async () => {
    st().setRange({surah: 67, ayah: 5}, {surah: 67, ayah: 30});
    await play('doori-269', 562, '67:5');
    // the surah's audio ends, and with it the range
    player().listeners.forEach(l => l({didJustFinish: true}));
    expect(st()).toMatchObject({
      playbackState: 'idle',
      numberingMode: 'disabled',
      currentSurah: 67,
    });
    // the bar's Play on a later page of the same surah
    mockPageKeys[563] = ['67:13', '67:14'];
    const {messages, barMessages} = await noticesDuring(async () => {
      st().clearRange();
      await st().startPlayback(563);
    });
    expect(st().ignoredStartVerseKey).toBe('67:13');
    const expected =
      'Al-Mulk plays from the beginning without verse tracking for this reciter.';
    expect(messages).toEqual([expected]);
    expect(barMessages).toEqual([expected]);
  });

  it('the same verse asked for twice is said twice, once per start', async () => {
    const {barMessages} = await noticesDuring(async () => {
      await play('doori-269', 562, '67:5');
      await play('doori-269', 562, '67:5');
    });
    expect(barMessages).toHaveLength(2);
  });

  it('the bar only notices what it cannot show inline', () => {
    const refused = {...base, timestampError: VERSE_TIMING_UNAVAILABLE_ERROR};
    expect(getPlayerBarNotice(base, refused, names)).toBeNull();
    const untracked = {
      ...base,
      playbackState: 'loading' as const,
      numberingMode: 'disabled' as const,
      currentSurah: 67,
    };
    expect(getPlayerBarNotice(base, untracked, names)).toBeNull();
    const skipped = {...untracked, ignoredStartVerseKey: '67:5'};
    expect(getPlayerBarNotice(base, skipped, names)).toEqual({
      title: 'Verse tracking unavailable',
      message:
        'Al-Mulk plays from the beginning without verse tracking for this reciter.',
      preset: 'none',
    });
    // once per start
    expect(getPlayerBarNotice(skipped, skipped, names)).toBeNull();
  });

  it('stop, and a tracked start, forget the skipped verse', async () => {
    await play('doori-269', 562, '67:5');
    expect(st().ignoredStartVerseKey).toBe('67:5');
    st().stop();
    expect(st().ignoredStartVerseKey).toBeNull();
    await play('doori-269', 562, '67:5');
    await play('hafs-clean', 2, '2:5');
    expect(st().ignoredStartVerseKey).toBeNull();
  });
});

describe("Shu'bah files numbered like Hafs but not exactly 1..n", () => {
  /** Al-Ikhlas, 3 s per entry from 0 s, numbered as given. */
  const ikhlas = (ayahs: number[]): AyahTimestamp[] =>
    ayahs.map((ayahNumber, i) => ({
      surahNumber: 112,
      ayahNumber,
      timestampFrom: i * 3000,
      timestampTo: (i + 1) * 3000,
      durationMs: 3000,
    }));
  // no entry for 112:3, which is recited from 6 s to 9 s
  const missingVerse3 = (): AyahTimestamp[] => [
    ...ikhlas([1, 2]),
    {...ikhlas([4])[0], timestampFrom: 9000, timestampTo: 12000},
  ];
  const names = (n: number) => (n === 112 ? 'Al-Ikhlas' : '');

  it('a verse missing: plays untracked and says so, never naming the verse before it', async () => {
    serveTimings({'shubah-305-112': missingVerse3()});
    const notices: string[] = [];
    const unsubscribe = useMushafPlayerStore.subscribe((s, prev) => {
      const n = getPlaybackNotice(prev, s, names);
      if (n) notices.push(n.message);
    });
    await play('shubah-305', 604, '112:3');
    unsubscribe();
    expect(st().numberingMode).toBe('disabled');
    expect(st().playbackState).toBe('playing');
    expect(player().seeks).toEqual([]); // from the start of the audio
    expect(notices).toEqual([
      'Al-Ikhlas plays from the beginning without verse tracking for this reciter.',
    ]);
    for (const ms of [500, 3500, 7000, 9500]) {
      at(ms);
      expect(st().currentVerseKeys).toEqual([]);
      expect(st().currentVerseLabel).toBeNull();
    }
    expect(formatPlaybackInfo('Al-Ikhlas', st())).toBe(
      'Al-Ikhlas · Verse tracking unavailable',
    );
  });

  it('a verse missing: a repeat of the verse before it is refused', async () => {
    serveTimings({'shubah-305-112': missingVerse3()});
    st().setRange({surah: 112, ayah: 2}, {surah: 112, ayah: 2});
    st().setVerseRepeatCount(2);
    await play('shubah-305', 604, '112:2');
    expect(st().playbackState).toBe('idle');
    expect(st().timestampError).toBe(VERSE_TIMING_UNAVAILABLE_ERROR);
    expect(createAudioPlayer).not.toHaveBeenCalled();
  });

  it('a verse recited twice in a row: started, highlighted and repeated as one verse', async () => {
    serveTimings({'shubah-305-112': ikhlas([1, 2, 3, 3, 4])});
    st().setRange({surah: 112, ayah: 3}, {surah: 112, ayah: 3});
    st().setVerseRepeatCount(0);
    st().setRangeRepeatCount(0);
    await play('shubah-305', 604, '112:3');
    expect(st().numberingMode).toBe('hafs');
    expect(player().seeks).toEqual([6]); // its first recitation
    // both recitations of 112:3, again and again, never 112:4
    const heard = await listen('shubah-305', 112, 6);
    expect(heard).toEqual([3, 3, 3, 3, 3, 3]);
    expect(st().currentVerseKeys).toEqual(['112:3']);
    expect(st().currentVerseLabel).toBe('112:3');
  });

  it('a verse recited twice in a row: a range of it plays both recitations, then stops', async () => {
    serveTimings({'shubah-305-112': ikhlas([1, 2, 3, 3, 4])});
    st().setRange({surah: 112, ayah: 3}, {surah: 112, ayah: 3});
    await play('shubah-305', 604, '112:3');
    const heard = await listen('shubah-305', 112);
    expect(heard).toEqual([3, 3]);
    expect(st().playbackState).toBe('idle');
  });
});

describe('a start while the previous surah still plays', () => {
  // The verse and repeat sheets set a range and start without stopping: the
  // surah playing keeps playing until the new one's audio is loaded.

  /** Hold back `set`'s timings of `surah`; the returned function sends them. */
  function holdTimings(set: string, surah: number): () => void {
    let release: () => void = () => undefined;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    getTimestampsForSurah.mockImplementation(async (s: string, n: number) => {
      if (s === set && n === surah) await gate;
      return fixtureTimings(s, n);
    });
    return () => release();
  }

  it('a verse the previous surah reaches meanwhile does not end the new start', async () => {
    await play('hafs-clean', 604, '112:1');
    const previous = player();
    const sendTimings = holdTimings('hafs-clean', 2);
    st().setRange({surah: 2, ayah: 30}, {surah: 2, ayah: 37});
    const start = st().startPlayback(5, '2:30');
    // al-Ikhlas moves on to its next verse while al-Baqarah loads
    at(entry('hafs-clean', 112, 2).timestampFrom + 50);
    const meanwhile = {state: st().playbackState, heard: previous.playing};
    sendTimings();
    await start;
    expect(st().timestampError).toBeNull(); // not "no verses to play"
    expect(st()).toMatchObject({
      playbackState: 'playing',
      currentSurah: 2,
      currentVerseKey: '2:30',
    });
    // al-Ikhlas played on until al-Baqarah replaced it, as before
    expect(meanwhile).toEqual({state: 'loading', heard: true});
    expect(player()).not.toBe(previous);
    expect(player().playing).toBe(true);
    expect(player().seeks).toEqual([
      entry('hafs-clean', 2, 30).timestampFrom / 1000,
    ]);
    // the new surah's own verses still end the range
    const heard = await listen('hafs-clean', 2);
    expect(heard).toEqual([30, 31, 32, 33, 34, 35, 36, 37]);
    expect(st().playbackState).toBe('idle');
  });

  it('the previous surah ending meanwhile does not start the surah after it', async () => {
    await play('hafs-clean', 1, '1:7');
    const players = mockPlayers.length;
    const sendTimings = holdTimings('hafs-clean', 2);
    st().setRange({surah: 2, ayah: 30}, {surah: 2, ayah: 37});
    const start = st().startPlayback(5, '2:30');
    // al-Fatihah's audio ends while al-Baqarah loads
    player().listeners.forEach(l => l({didJustFinish: true}));
    sendTimings();
    await start;
    await flush();
    expect(st().timestampError).toBeNull();
    expect(st()).toMatchObject({
      playbackState: 'playing',
      currentSurah: 2,
      currentVerseKey: '2:30',
    });
    // one player, for the start asked for: not al-Baqarah from its beginning
    expect(mockPlayers.length).toBe(players + 1);
    expect(player().seeks).toEqual([
      entry('hafs-clean', 2, 30).timestampFrom / 1000,
    ]);
  });

  it('a verse the previous surah reaches meanwhile does not use up a repeat of the new start', async () => {
    await play('hafs-clean', 604, '112:1');
    const sendTimings = holdTimings('hafs-clean', 2);
    // the repeat options sheet: 2:30-2:31, each verse twice
    st().setRange({surah: 2, ayah: 30}, {surah: 2, ayah: 31});
    st().setVerseRepeatCount(2);
    const start = st().startPlayback(5, '2:30');
    at(entry('hafs-clean', 112, 2).timestampFrom + 50);
    sendTimings();
    await start;
    expect(st()._versePlayCount).toBe(1);
    const heard = await listen('hafs-clean', 2);
    expect(heard).toEqual([30, 30, 31, 31]);
    expect(st().playbackState).toBe('idle');
  });
});

describe('a set-level vote that gets no answer', () => {
  it('al-Fatihah starts without verse tracking once the vote times out, and later starts do not wait again', async () => {
    // al-Fatihah's own timings arrive; the vote's sample surahs never do
    getTimestampsForSurah.mockImplementation(
      (set: string, surah: number): Promise<AyahTimestamp[] | null> =>
        surah === 1
          ? Promise.resolve(fixtureTimings(set, surah))
          : new Promise(() => undefined),
    );
    st().setReciter('warsh-14', 'Test Reciter');
    const start = st().startPlayback(1, '1:1');
    await flush();
    expect(st().playbackState).toBe('loading');
    await jest.advanceTimersByTimeAsync(SET_CLASS_VOTE_TIMEOUT_MS);
    await flush();
    expect(st()).toMatchObject({
      playbackState: 'playing',
      currentSurah: 1,
      numberingMode: 'disabled',
    });
    expect(formatPlaybackInfo('Al-Fatihah', st())).toBe(
      'Al-Fatihah · Verse tracking unavailable',
    );
    expect(player().playing).toBe(true);
    await start;
    // the failed vote is remembered: the next start is untracked at once
    st().stop();
    await play('warsh-14', 1, '1:1');
    expect(st()).toMatchObject({
      playbackState: 'playing',
      numberingMode: 'disabled',
    });
  });
});
// @ai-end
