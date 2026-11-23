// @ai-generated
/**
 * The repeat counts chosen in the play options sheet are a saved choice;
 * the counts a playback runs with are its own.
 *
 * They used to be the same two saved fields. A verse's one-off Repeat wrote
 * "Loop" into them, so the play options opened on Loop for every later Play,
 * also after a restart (on iOS 26 that sheet is the only way to play), and a
 * plain Play wrote "once" over a saved "each verse 3x".
 *
 * Drives the real store/mushafPlayerStore.ts +
 * services/audio/MushafAudioService.ts against a fake player and a fake
 * disk, with real timing fixtures.
 */

interface MockPlayer {
  currentTime: number;
  duration: number;
  loop: boolean;
  playing: boolean;
  isLoaded: boolean;
  isBuffering: boolean;
  seeks: number[];
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  setPlaybackRate(rate: number): void;
  addListener(): {remove(): void};
  remove(): void;
}

// `mock`-prefixed so the hoisted jest.mock factories below can use them.
const mockPlayers: MockPlayer[] = [];
const mockDisk = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockDisk.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    mockDisk.set(key, value);
  },
  removeItem: async (key: string) => {
    mockDisk.delete(key);
  },
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => {
    const player: MockPlayer = {
      currentTime: 0,
      duration: 99999,
      loop: false,
      playing: false,
      isLoaded: true,
      isBuffering: false,
      seeks: [],
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
      setPlaybackRate() {},
      addListener: () => ({remove: () => undefined}),
      remove() {},
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
    getOrderedVerseKeysForPage: (page: number) =>
      page === 5 ? ['2:30', '2:31'] : [],
  },
}));

jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: {getState: () => ({rewayah: 'hafs'})},
}));

jest.mock('@/utils/playbackVerseUnits', () => ({
  readyVerseUnits: () => null,
  canShowRewayahVerses: () => true,
  subscribeVerseUnitsChanges: () => () => undefined,
}));

import {loadTimings} from '@/services/timestamps/__fixtures__/timingFixtures';

type Store = typeof import('../mushafPlayerStore').useMushafPlayerStore;

const KEY = 'mushaf-player-store';
const LOOP = 0;

let store: Store;
const st = () => store.getState();
const player = () => mockPlayers[mockPlayers.length - 1];

/** Lets storage reads and writes (and a start's loading) settle. */
async function settle() {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

/** A fresh app launch: a new store reading the same disk. */
async function launch() {
  jest.isolateModules(() => {
    store = require('../mushafPlayerStore').useMushafPlayerStore;
  });
  await settle();
}

const saved = () => JSON.parse(mockDisk.get(KEY) as string);

const startOf = (ayah: number) =>
  loadTimings('hafs-clean', 2)!.find(e => e.ayahNumber === ayah)!.timestampFrom;

/** Move the playhead and let MushafAudioService's 200 ms poll run. */
function at(ms: number) {
  player().currentTime = ms / 1000;
  jest.advanceTimersByTime(200);
}

/** The play options sheet's Play Audio. */
async function playFromOptions(verseRepeat: number, rangeRepeat: number) {
  st().stop();
  st().setReciter('hafs-clean', 'Test Reciter');
  st().setRange({surah: 2, ayah: 30}, {surah: 2, ayah: 31});
  st().setVerseRepeatCount(verseRepeat);
  st().setRangeRepeatCount(rangeRepeat);
  st().saveRepeatCounts(verseRepeat, rangeRepeat);
  await st().startPlayback(5, '2:30');
}

/** The verse sheet's Repeat on one verse. */
async function repeatVerse() {
  st().stop();
  st().setRange({surah: 2, ayah: 30}, {surah: 2, ayah: 30});
  st().setVerseRepeatCount(LOOP);
  st().setRangeRepeatCount(LOOP);
  await st().startPlayback(5, '2:30');
}

/** The player bar's Play: the page on screen, once. */
async function plainPlay() {
  st().clearRange();
  st().setVerseRepeatCount(1);
  st().setRangeRepeatCount(1);
  await st().startPlayback(5);
}

beforeAll(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

beforeEach(async () => {
  mockDisk.clear();
  mockPlayers.length = 0;
  await launch();
  st().setReciter('hafs-clean', 'Test Reciter');
});

afterEach(() => {
  st().stop();
});

describe("a verse's one-off Repeat", () => {
  it('loops, without becoming the choice of the play options', async () => {
    await repeatVerse();
    expect(st().playbackState).toBe('playing');
    expect(st()).toMatchObject({
      verseRepeatCount: LOOP,
      rangeRepeatCount: LOOP,
    });
    expect(st()).toMatchObject({
      savedVerseRepeatCount: 1,
      savedRangeRepeatCount: 1,
    });

    // The verse does loop.
    at(startOf(30) + 50);
    at(startOf(31) + 50);
    expect(st().currentVerseKey).toBe('2:30');
    expect(player().seeks[player().seeks.length - 1]).toBeCloseTo(
      startOf(30) / 1000,
    );
  });

  it('is not what the play options open on after a restart', async () => {
    await repeatVerse();
    st().stop();
    await settle();
    expect(saved().state).toEqual({
      rewayatId: 'hafs-clean',
      reciterName: 'Test Reciter',
      rate: 1,
      savedVerseRepeatCount: 1,
      savedRangeRepeatCount: 1,
      recentRewayatIds: ['hafs-clean'], // @ai: the Listen sheet's Recent
    });

    await launch();
    expect(st()).toMatchObject({
      savedVerseRepeatCount: 1,
      savedRangeRepeatCount: 1,
      verseRepeatCount: 1,
      rangeRepeatCount: 1,
    });
  });

  it('leaves a choice made in the play options as it was', async () => {
    await playFromOptions(3, 1);
    await repeatVerse();
    await settle();
    expect(st()).toMatchObject({
      savedVerseRepeatCount: 3,
      savedRangeRepeatCount: 1,
    });
    expect(saved().state).toMatchObject({
      savedVerseRepeatCount: 3,
      savedRangeRepeatCount: 1,
    });
  });
});

describe('the choice made in the play options', () => {
  it('is saved, and still there after a restart', async () => {
    await playFromOptions(3, LOOP);
    await settle();

    await launch();
    expect(st()).toMatchObject({
      savedVerseRepeatCount: 3,
      savedRangeRepeatCount: LOOP,
    });
    // ...as a choice to offer, not as a playback that is already looping.
    expect(st()).toMatchObject({verseRepeatCount: 1, rangeRepeatCount: 1});
  });

  it('is not wiped by a plain Play', async () => {
    await playFromOptions(3, 1);
    st().stop();
    await plainPlay();
    await settle();
    expect(st()).toMatchObject({
      savedVerseRepeatCount: 3,
      savedRangeRepeatCount: 1,
    });

    await launch();
    expect(st()).toMatchObject({
      savedVerseRepeatCount: 3,
      savedRangeRepeatCount: 1,
    });
  });

  it('does not repeat a playback that did not ask for it', async () => {
    await playFromOptions(LOOP, LOOP);
    st().stop();

    await plainPlay();
    at(startOf(30) + 50);
    const seeks = player().seeks.length;
    at(startOf(31) + 50);
    expect(st().currentVerseKey).toBe('2:31');
    expect(player().seeks).toHaveLength(seeks);
  });

  it('read from storage again mid-playback leaves the playback its counts', async () => {
    await playFromOptions(3, 1);
    await repeatVerse();
    await settle();

    // services/rehydrateOnForeground retries a read that failed.
    await store.persist.rehydrate();
    expect(st()).toMatchObject({
      verseRepeatCount: LOOP,
      rangeRepeatCount: LOOP,
      savedVerseRepeatCount: 3,
      savedRangeRepeatCount: 1,
    });
  });
});

describe('state saved before the choice was kept apart', () => {
  const launchWithOld = async (verse: unknown, range: unknown) => {
    mockDisk.set(
      KEY,
      JSON.stringify({
        state: {
          rewayatId: 'hafs-clean',
          reciterName: 'Test Reciter',
          rate: 1.5,
          verseRepeatCount: verse,
          rangeRepeatCount: range,
        },
        version: 0,
      }),
    );
    await launch();
  };

  // What a one-off Repeat wrote (one verse, several verses).
  it.each([
    [LOOP, LOOP],
    [1, LOOP],
  ])('drops a leftover of Repeat (%i, %i)', async (verse, range) => {
    await launchWithOld(verse, range);
    expect(st()).toMatchObject({
      rewayatId: 'hafs-clean',
      reciterName: 'Test Reciter',
      rate: 1.5,
      savedVerseRepeatCount: 1,
      savedRangeRepeatCount: 1,
      verseRepeatCount: 1,
      rangeRepeatCount: 1,
    });
    expect(saved()).toEqual({
      state: {
        rewayatId: 'hafs-clean',
        reciterName: 'Test Reciter',
        rate: 1.5,
        savedVerseRepeatCount: 1,
        savedRangeRepeatCount: 1,
        recentRewayatIds: [], // @ai: the Listen sheet's Recent
      },
      version: 1,
    });
  });

  // Pairs only the play options could have written.
  it.each([
    [3, 1],
    [2, LOOP],
    [LOOP, 1],
    [1, 2],
  ])('keeps a choice of the play options (%i, %i)', async (verse, range) => {
    await launchWithOld(verse, range);
    expect(st()).toMatchObject({
      savedVerseRepeatCount: verse,
      savedRangeRepeatCount: range,
      // ...and it is not the count of the next playback
      verseRepeatCount: 1,
      rangeRepeatCount: 1,
    });
  });

  it('starts over from counts it cannot read', async () => {
    await launchWithOld('3', null);
    expect(st()).toMatchObject({
      rate: 1.5,
      savedVerseRepeatCount: 1,
      savedRangeRepeatCount: 1,
      verseRepeatCount: 1,
      rangeRepeatCount: 1,
    });
  });
});
