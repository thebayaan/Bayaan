// @ai-generated
/**
 * The mushaf player's verse label (player bar, iOS toolbar, lock screen) is
 * in the numbering of the mushaf on screen. Switching the mushaf's rewayah
 * mid-playback must re-label the verse being recited at once, also while
 * paused, instead of keeping the previous mushaf's number until the next
 * verse starts (a Warsh "2:4" is Hafs 2:5, a different verse in a Hafs
 * mushaf).
 *
 * Drives the real store with the real settings-store subscription surface
 * (a zustand store standing in for useMushafSettingsStore), real timing
 * fixtures and a fake expo-audio player.
 */

interface MockPlayer {
  currentTime: number;
  playing: boolean;
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

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => {
    const player: MockPlayer = {
      currentTime: 0,
      playing: false,
      listeners: [],
      play() {
        this.playing = true;
      },
      pause() {
        this.playing = false;
      },
      seekTo(seconds: number) {
        this.currentTime = seconds;
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
  mushafVerseMapService: {getOrderedVerseKeysForPage: () => []},
}));

jest.mock('@/store/mushafSettingsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {useMushafSettingsStore: create(() => ({rewayah: 'hafs'}))};
});

// @ai-start
// The mushaf's verse units are ready: its own verse numbers may be shown
// (without them the label is withheld, see utils/playbackVerseUnits.ts).
jest.mock('@/utils/playbackVerseUnits', () => ({
  readyVerseUnits: () => null,
  canShowRewayahVerses: () => true,
  subscribeVerseUnitsChanges: () => () => undefined,
}));
// @ai-end

import type {AyahTimestamp} from '@/types/timestamps';
import {formatPlaybackInfo, useMushafPlayerStore} from '../mushafPlayerStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {timingNumberingService} from '@/services/timestamps/TimingNumberingService';
import {loadTimings} from '@/services/timestamps/__fixtures__/timingFixtures';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

const st = () => useMushafPlayerStore.getState();
const player = () => mockPlayers[mockPlayers.length - 1];

function entry(set: string, surah: number, ayah: number): AyahTimestamp {
  return loadTimings(set, surah)!.find(e => e.ayahNumber === ayah)!;
}

/** Move the playhead and let MushafAudioService's 200 ms poll run. */
function at(ms: number) {
  player().currentTime = ms / 1000;
  jest.advanceTimersByTime(200);
}

function showMushaf(rewayah: RewayahId) {
  (
    useMushafSettingsStore as unknown as {setState: (s: object) => void}
  ).setState({rewayah});
}

async function play(set: string, key: string) {
  st().setReciter(set, 'Test Reciter');
  await st().startPlayback(1, key);
}

beforeAll(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

beforeEach(() => {
  st().stop();
  st().clearRange();
  mockPlayers.length = 0;
  timingNumberingService.reset();
  showMushaf('hafs');
});

describe('a rewayah switch mid-playback re-labels the verse being recited', () => {
  it('Warsh reciter: Warsh 2:4 becomes Hafs 2:5 in a Hafs mushaf, at once', async () => {
    showMushaf('warsh');
    await play('warsh-14', '2:5');
    at(entry('warsh-14', 2, 4).timestampFrom + 50);
    expect(st().currentVerseKeys).toEqual(['2:5']);
    expect(st().currentVerseLabel).toBe('2:4');

    showMushaf('hafs');
    expect(st().currentVerseLabel).toBe('2:5');
    expect(formatPlaybackInfo('Al-Baqarah', st())).toBe('Al-Baqarah 2:5');
    // the highlight (Hafs keys) is untouched
    expect(st().currentVerseKeys).toEqual(['2:5']);
  });

  it('also while paused', async () => {
    showMushaf('warsh');
    await play('warsh-14', '2:5');
    at(entry('warsh-14', 2, 4).timestampFrom + 50);
    st().setPlaybackState('paused');
    showMushaf('hafs');
    expect(st().currentVerseLabel).toBe('2:5');
    showMushaf('warsh');
    expect(st().currentVerseLabel).toBe('2:4');
  });

  it('a reciter verse spanning Hafs verses reads as a range in a Hafs mushaf', async () => {
    showMushaf('warsh');
    await play('warsh-14', '2:1');
    expect(st().currentVerseLabel).toBe('2:1');
    showMushaf('hafs');
    expect(st().currentVerseLabel).toBe('2:1-2');
  });

  it('Hafs reciter: the Hafs verse gets the number of the mushaf on screen', async () => {
    await play('hafs-clean', '2:5');
    expect(st().currentVerseLabel).toBe('2:5');
    showMushaf('warsh');
    expect(st().currentVerseLabel).toBe('2:4');
    showMushaf('hafs');
    expect(st().currentVerseLabel).toBe('2:5');
  });

  it('the Fatiha basmala has no number in a Warsh mushaf', async () => {
    await play('hafs-clean', '1:1');
    expect(st().currentVerseLabel).toBe('1:1');
    showMushaf('warsh');
    expect(st().currentVerseLabel).toBeNull();
    expect(formatPlaybackInfo('Al-Fatihah', st())).toBe('Al-Fatihah');
  });

  it('nothing to re-label while idle or without verse tracking', async () => {
    showMushaf('warsh');
    expect(st().currentVerseLabel).toBeNull();
    await play('doori-269', '67:5');
    expect(st().numberingMode).toBe('disabled');
    showMushaf('hafs');
    expect(st().currentVerseLabel).toBeNull();
  });
});
