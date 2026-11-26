// @ai-generated
/**
 * The mushaf player follows what the native audio player really does.
 *
 * Drives the real store/mushafPlayerStore.ts +
 * services/audio/MushafAudioService.ts against a fake expo-audio player that
 * reports its status as the native ones do (expo-audio's AudioPlayer.swift /
 * AudioPlayer.kt), with real timing fixtures.
 *
 *  - paused from outside (headphones unplugged, a call, another app): the
 *    store says 'paused' and one tap resumes;
 *  - started from outside (the interruption ended, the lock screen): the
 *    store says 'playing' and the chosen speed is applied again (iOS resumes
 *    at 1x);
 *  - statuses that are old, buffering, or the surah ending are not taken for
 *    a pause or a start;
 *  - audio that cannot be loaded stops playback with a message instead of a
 *    bar that shows the verse as playing over silence, and timings that
 *    could not be fetched are told apart from timings the reciter lacks.
 */
import type {AyahTimestamp} from '@/types/timestamps';

interface MockStatus {
  isLoaded: boolean;
  playing: boolean;
  isBuffering: boolean;
  didJustFinish: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
}

interface MockPlayer {
  uri: string;
  currentTime: number;
  duration: number;
  loop: boolean;
  playing: boolean;
  isLoaded: boolean;
  isBuffering: boolean;
  rates: number[];
  removed: boolean;
  listeners: ((status: MockStatus) => void)[];
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  setPlaybackRate(rate: number): void;
  addListener(
    event: string,
    cb: (status: MockStatus) => void,
  ): {remove(): void};
  remove(): void;
  /** Send a status as the native player would: its state now, plus `over`. */
  emit(over?: Partial<MockStatus>): void;
}

const mockPlayers: MockPlayer[] = [];
const mockPageKeys: Record<number, string[]> = {};
// The OS refuses play() without an error (no audio focus, silent mode).
const mockNative = {refusePlay: false};
// Whether the reciter has timings for a surah (the catalogue's answer).
const mockCatalogue = {covered: true};
const mockCoordinator = {mushafWillPlay: jest.fn(), sourceDidStop: jest.fn()};

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(({uri}: {uri: string}) => {
    const player: MockPlayer = {
      uri,
      currentTime: 0,
      duration: 99999,
      loop: false,
      playing: false,
      isLoaded: true,
      isBuffering: false,
      rates: [],
      removed: false,
      listeners: [],
      play() {
        if (!mockNative.refusePlay) this.playing = true;
      },
      pause() {
        this.playing = false;
      },
      seekTo(seconds: number) {
        this.currentTime = seconds;
        return Promise.resolve();
      },
      setPlaybackRate(rate: number) {
        this.rates.push(rate);
      },
      addListener(_event, cb) {
        this.listeners.push(cb);
        return {
          remove: () => {
            this.listeners = this.listeners.filter(l => l !== cb);
          },
        };
      },
      remove() {
        this.removed = true;
      },
      emit(over = {}) {
        const status: MockStatus = {
          isLoaded: this.isLoaded,
          playing: this.playing,
          isBuffering: this.isBuffering,
          didJustFinish: false,
          currentTime: this.currentTime,
          duration: this.duration,
          error: null,
          ...over,
        };
        [...this.listeners].forEach(l => l(status));
      },
    };
    mockPlayers.push(player);
    return player;
  }),
}));

jest.mock('@/services/audio/AudioCoordinator', () => ({
  // Read on use: the imports below run before the consts above are set.
  get audioCoordinator() {
    return mockCoordinator;
  },
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
  timestampFetchService: {
    hasSurah: () => mockCatalogue.covered,
    hasSource: () => true,
  },
}));

jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {
    getOrderedVerseKeysForPage: (page: number) => mockPageKeys[page] ?? [],
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

import {
  AUDIO_LOAD_FAILED_ERROR,
  TIMESTAMPS_LOAD_FAILED_ERROR,
  TIMESTAMPS_UNAVAILABLE_ERROR,
  getPlaybackNotice,
  getPlayerBarNotice,
  isRetryablePlaybackError,
  useMushafPlayerStore,
} from '../mushafPlayerStore';
import {mushafAudioService} from '@/services/audio/MushafAudioService';
import {timestampService} from '@/services/timestamps/TimestampService';
import {timingNumberingService} from '@/services/timestamps/TimingNumberingService';
import {loadTimings} from '@/services/timestamps/__fixtures__/timingFixtures';

Object.assign(mockPageKeys, {
  1: ['1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7'],
  2: ['2:1', '2:2', '2:3', '2:4', '2:5'],
  5: ['2:30', '2:31'],
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

/** Start at 2:30 and let the time after play() pass. */
async function playing() {
  st().setReciter('hafs-clean', 'Test Reciter');
  await st().startPlayback(5, '2:30');
  at(entry('hafs-clean', 2, 30).timestampFrom + 50);
  jest.advanceTimersByTime(2000);
  expect(st()).toMatchObject({
    playbackState: 'playing',
    currentVerseKey: '2:30',
  });
}

/** The system pauses the player: headphones unplugged, a call, another app. */
function pausedByTheSystem() {
  player().playing = false;
  player().emit();
}

/** The system starts the player again: the call ended, the lock screen. */
function startedByTheSystem() {
  player().playing = true;
  player().emit();
}

/** The bar's play / pause button. */
function tapPlayPause() {
  if (st().playbackState === 'playing') {
    mushafAudioService.pause();
    st().setPlaybackState('paused');
  } else {
    mushafAudioService.play();
    st().setPlaybackState('playing');
  }
}

beforeAll(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

const getTimestampsForSurah =
  timestampService.getTimestampsForSurah as jest.Mock;
const fixtureTimings = getTimestampsForSurah.getMockImplementation()!;

beforeEach(() => {
  st().stop();
  st().setVerseRepeatCount(1);
  st().setRangeRepeatCount(1);
  st().clearRange();
  st().setRate(1);
  mockPlayers.length = 0;
  mockNative.refusePlay = false;
  mockCatalogue.covered = true;
  getTimestampsForSurah.mockImplementation(fixtureTimings);
  mockCoordinator.mushafWillPlay.mockClear();
  timingNumberingService.reset();
});

describe('paused from outside', () => {
  it('the store follows: paused, and the verse tracking stops', async () => {
    await playing();
    pausedByTheSystem();
    expect(st().playbackState).toBe('paused');
    expect(mushafAudioService.getIsPlaying()).toBe(false);
    // the verse being recited stays shown, as for a pause from the bar
    expect(st().currentVerseKey).toBe('2:30');
    at(entry('hafs-clean', 2, 31).timestampFrom + 50);
    expect(st().currentVerseKey).toBe('2:30');
  });

  it('one tap resumes', async () => {
    await playing();
    pausedByTheSystem();
    tapPlayPause();
    expect(player().playing).toBe(true);
    expect(st().playbackState).toBe('playing');
    expect(mushafAudioService.getIsPlaying()).toBe(true);
    at(entry('hafs-clean', 2, 31).timestampFrom + 50);
    expect(st().currentVerseKey).toBe('2:31');
  });

  it('buffering is not a pause', async () => {
    await playing();
    player().playing = false;
    player().isBuffering = true;
    player().emit();
    expect(st().playbackState).toBe('playing');
    expect(mushafAudioService.getIsPlaying()).toBe(true);
    // Android reports a rebuffer as not loaded
    player().isLoaded = false;
    player().isBuffering = false;
    player().emit();
    expect(st().playbackState).toBe('playing');
  });

  it('an old "not playing" status after our own play() is not a pause', async () => {
    await playing();
    tapPlayPause(); // pause
    tapPlayPause(); // play: the status of the pause arrives only now
    player().emit({playing: false});
    expect(st().playbackState).toBe('playing');
    expect(mushafAudioService.getIsPlaying()).toBe(true);
    // ...and however late it arrives, the player itself says it plays
    jest.advanceTimersByTime(5000);
    player().emit({playing: false});
    expect(st().playbackState).toBe('playing');
  });

  it('a pause from outside right after play() is seen once the status settles', async () => {
    await playing();
    tapPlayPause(); // pause
    jest.advanceTimersByTime(2000);
    tapPlayPause(); // play
    pausedByTheSystem(); // within the time statuses are not acted on
    expect(st().playbackState).toBe('playing');
    jest.advanceTimersByTime(1000);
    expect(st().playbackState).toBe('paused');
    expect(mushafAudioService.getIsPlaying()).toBe(false);
  });

  it('play() refused by the system: the bar does not claim to play', async () => {
    await playing();
    tapPlayPause(); // pause
    jest.advanceTimersByTime(2000);
    mockNative.refusePlay = true; // e.g. no audio focus during a call
    tapPlayPause();
    expect(st().playbackState).toBe('playing');
    jest.advanceTimersByTime(1000);
    expect(st().playbackState).toBe('paused');
    expect(mushafAudioService.getIsPlaying()).toBe(false);
  });

  it('a surah still loading its audio is not paused by the check', async () => {
    st().setReciter('hafs-clean', 'Test Reciter');
    await st().startPlayback(5, '2:30');
    // slow network: not loaded when the statuses become trusted
    player().isLoaded = false;
    player().playing = false;
    jest.advanceTimersByTime(3000);
    expect(st().playbackState).toBe('playing');
    expect(mushafAudioService.getIsPlaying()).toBe(true);
  });
});

describe('started from outside', () => {
  it('the store follows, the speed is applied again and tracking resumes', async () => {
    st().setRate(1.5);
    await playing();
    pausedByTheSystem();
    jest.advanceTimersByTime(30000); // the call
    player().rates.length = 0;
    mockCoordinator.mushafWillPlay.mockClear();
    startedByTheSystem(); // iOS resumes at 1x
    expect(st().playbackState).toBe('playing');
    expect(mushafAudioService.getIsPlaying()).toBe(true);
    expect(player().rates).toEqual([1.5]);
    // no other source may play along
    expect(mockCoordinator.mushafWillPlay).toHaveBeenCalledTimes(1);
    at(entry('hafs-clean', 2, 31).timestampFrom + 50);
    expect(st().currentVerseKey).toBe('2:31');
  });

  it('after a pause from the bar (the lock screen play button)', async () => {
    await playing();
    tapPlayPause(); // pause
    jest.advanceTimersByTime(2000);
    startedByTheSystem();
    expect(st().playbackState).toBe('playing');
    expect(mushafAudioService.getIsPlaying()).toBe(true);
  });

  it('an old "playing" status after our own pause() is not a start', async () => {
    await playing();
    tapPlayPause(); // pause: a status sent just before arrives only now
    mockCoordinator.mushafWillPlay.mockClear();
    player().emit({playing: true});
    expect(st().playbackState).toBe('paused');
    // ...and however late it arrives, the player itself says it is paused
    jest.advanceTimersByTime(5000);
    player().emit({playing: true});
    expect(st().playbackState).toBe('paused');
    expect(mushafAudioService.getIsPlaying()).toBe(false);
    // so the main player is never paused for a mushaf that is not playing
    expect(mockCoordinator.mushafWillPlay).not.toHaveBeenCalled();
  });
});

describe('the end of the surah is not a pause', () => {
  async function playLastVerseOfFatihah() {
    st().setReciter('hafs-clean', 'Test Reciter');
    await st().startPlayback(1, '1:7');
    at(entry('hafs-clean', 1, 7).timestampFrom + 50);
    jest.advanceTimersByTime(2000);
    const timings = T('hafs-clean', 1);
    const end = timings[timings.length - 1].timestampTo / 1000;
    return {fatihah: player(), end};
  }

  it('"not playing" at the end, then the finish: the next surah plays', async () => {
    const {fatihah, end} = await playLastVerseOfFatihah();
    fatihah.duration = end;
    fatihah.currentTime = end;
    // iOS: the player stopping at the end is reported first
    pausedByTheSystem();
    expect(st().playbackState).toBe('playing');
    fatihah.emit({didJustFinish: true});
    await flush();
    expect(st()).toMatchObject({playbackState: 'playing', currentSurah: 2});
    expect(player()).not.toBe(fatihah);
    expect(player().playing).toBe(true);
  });

  it('even when it was taken for a pause, the finish still moves on', async () => {
    const {fatihah} = await playLastVerseOfFatihah();
    // no duration known: nothing tells this status from a pause
    fatihah.duration = 0;
    pausedByTheSystem();
    expect(st().playbackState).toBe('paused');
    fatihah.emit({didJustFinish: true});
    await flush();
    expect(st()).toMatchObject({playbackState: 'playing', currentSurah: 2});
    expect(player().playing).toBe(true);
  });

  it('a finish after a pause from the bar is still ignored', async () => {
    const {fatihah} = await playLastVerseOfFatihah();
    tapPlayPause(); // pause
    fatihah.emit({didJustFinish: true});
    await flush();
    expect(st()).toMatchObject({playbackState: 'paused', currentSurah: 1});
  });
});

describe('a player that was replaced', () => {
  it('its late statuses change nothing', async () => {
    await playing();
    const old = player();
    const listeners = [...old.listeners];
    await st().startPlayback(2, '2:1');
    jest.advanceTimersByTime(2000);
    expect(player()).not.toBe(old);
    listeners.forEach(l =>
      l({
        isLoaded: true,
        playing: false,
        isBuffering: false,
        didJustFinish: false,
        currentTime: 1,
        duration: 100,
        error: null,
      }),
    );
    expect(st().playbackState).toBe('playing');
    expect(mushafAudioService.getIsPlaying()).toBe(true);
  });
});

describe('the audio cannot be played', () => {
  /** Every notice the store's updates give the toolbar and the bar. */
  function watchNotices() {
    const toolbar: string[] = [];
    const bar: string[] = [];
    const unsubscribe = useMushafPlayerStore.subscribe((next, prev) => {
      const forToolbar = getPlaybackNotice(prev, next, () => '');
      if (forToolbar) toolbar.push(forToolbar.message);
      const forBar = getPlayerBarNotice(prev, next, () => '');
      if (forBar) bar.push(forBar.message);
    });
    return {toolbar, bar, unsubscribe};
  }

  it('a failed load: playback stops and says so, never "playing" over silence', async () => {
    st().setReciter('hafs-clean', 'Test Reciter');
    await st().startPlayback(5, '2:30');
    const failed = player();
    const notices = watchNotices();
    // offline: the player reports that its source failed
    failed.playing = false;
    failed.emit({error: 'The Internet connection appears to be offline.'});
    notices.unsubscribe();
    expect(st()).toMatchObject({
      playbackState: 'idle',
      timestampError: AUDIO_LOAD_FAILED_ERROR,
      currentVerseKey: null,
    });
    expect(failed.removed).toBe(true);
    expect(mushafAudioService.getIsPlaying()).toBe(false);
    expect(mushafAudioService.hasPlayer()).toBe(false);
    // the toolbar and the bar both say it; the bar keeps Play to try again
    expect(notices.toolbar).toEqual([AUDIO_LOAD_FAILED_ERROR]);
    expect(notices.bar).toEqual([AUDIO_LOAD_FAILED_ERROR]);
    expect(isRetryablePlaybackError(st().timestampError)).toBe(true);
  });

  it('a stream that breaks mid-way stops the same way', async () => {
    await playing();
    player().emit({error: 'Source error'});
    expect(st()).toMatchObject({
      playbackState: 'idle',
      timestampError: AUDIO_LOAD_FAILED_ERROR,
    });
    // nothing is left running that would report a verse later
    jest.advanceTimersByTime(5000);
    expect(st().currentVerseKey).toBeNull();
  });

  it('Play again clears the message and plays when the audio loads', async () => {
    await playing();
    player().emit({error: 'Source error'});
    await st().startPlayback(5);
    expect(st()).toMatchObject({
      playbackState: 'playing',
      timestampError: null,
      currentVerseKey: '2:30',
    });
  });

  it('the failed audio of a playback being replaced is not reported', async () => {
    await playing();
    const old = player();
    let release: () => void = () => undefined;
    const gate = new Promise<void>(resolve => (release = resolve));
    getTimestampsForSurah.mockImplementation(
      async (set: string, surah: number) => {
        await gate;
        return fixtureTimings(set, surah);
      },
    );
    const start = st().startPlayback(2, '2:1');
    old.emit({error: 'Source error'});
    expect(st()).toMatchObject({
      playbackState: 'loading',
      timestampError: null,
    });
    release();
    await start;
    expect(st()).toMatchObject({
      playbackState: 'playing',
      timestampError: null,
      currentVerseKey: '2:1',
    });
  });
});

describe('no timings to play', () => {
  it('they could not be fetched: a connection problem, and Play stays available', async () => {
    getTimestampsForSurah.mockImplementation(async () => null);
    st().setReciter('hafs-clean', 'Test Reciter');
    await st().startPlayback(5, '2:30');
    expect(st()).toMatchObject({
      playbackState: 'idle',
      timestampError: TIMESTAMPS_LOAD_FAILED_ERROR,
    });
    expect(isRetryablePlaybackError(st().timestampError)).toBe(true);
  });

  it('the reciter has none for this surah: try another reciter', async () => {
    getTimestampsForSurah.mockImplementation(async () => null);
    mockCatalogue.covered = false;
    st().setReciter('hafs-clean', 'Test Reciter');
    await st().startPlayback(5, '2:30');
    expect(st()).toMatchObject({
      playbackState: 'idle',
      timestampError: TIMESTAMPS_UNAVAILABLE_ERROR,
    });
    expect(isRetryablePlaybackError(st().timestampError)).toBe(false);
  });

  // @ai-start
  /** Play al-Ikhlas's last verse to its end: the next surah is al-Falaq. */
  async function playIntoAlFalaq() {
    st().setReciter('hafs-clean', 'Test Reciter');
    await st().startPlayback(604, '112:4');
    at(entry('hafs-clean', 112, 4).timestampFrom + 50);
    jest.advanceTimersByTime(2000);
    expect(st().playbackState).toBe('playing');
    player().emit({didJustFinish: true});
    await flush();
  }

  it('the next surah could not be fetched: said so, with Play to try again', async () => {
    // only al-Falaq's timings fail (the fixtures have none for it)
    await playIntoAlFalaq();
    expect(getTimestampsForSurah).toHaveBeenLastCalledWith('hafs-clean', 113);
    expect(st()).toMatchObject({
      playbackState: 'idle',
      timestampError: TIMESTAMPS_LOAD_FAILED_ERROR,
    });
  });

  it('the reciter has none for the next surah: said so instead of a silent stop', async () => {
    mockCatalogue.covered = false;
    await playIntoAlFalaq();
    expect(st()).toMatchObject({
      playbackState: 'idle',
      timestampError: TIMESTAMPS_UNAVAILABLE_ERROR,
    });
  });
  // @ai-end
});
