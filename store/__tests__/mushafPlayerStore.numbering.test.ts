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

import {
  useMushafPlayerStore,
  isVerseKeyPlaying,
  selectPlaybackVerseKeys,
  VERSE_TIMING_UNAVAILABLE_ERROR,
  // @ai-start
  RANGE_UNPLAYABLE_ERROR,
  selectPlaybackVerseKeysId,
  usePlaybackVerseKeys,
  // @ai-end
} from '../mushafPlayerStore';
import {parseVerseKeyListId} from '@/utils/timestampNumbering'; // @ai
import {mushafAudioService} from '@/services/audio/MushafAudioService';
import {timingNumberingService} from '@/services/timestamps/TimingNumberingService';
import {
  loadTimings,
  oracleHafsAyahs,
} from '@/services/timestamps/__fixtures__/timingFixtures';
import {createAudioPlayer} from 'expo-audio';

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
// @ai-end
