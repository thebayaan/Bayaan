// @ai-generated
// The listening session of a track, end to end: the real provider over the
// real player store and the real AnalyticsService. Only the native player, its
// service and the side services are fakes. The test sends native status
// updates the way expo-audio does: after the store action that caused them.
import React from 'react';
import {act, create, ReactTestRenderer} from 'react-test-renderer';
import type {Track} from '@/types/audio';

type Status = {
  isLoaded: boolean;
  playing: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  didJustFinish: boolean;
};

let mockStatus: Status = {
  isLoaded: false,
  playing: false,
  isBuffering: false,
  currentTime: 0,
  duration: 0,
  didJustFinish: false,
};
const mockStatusListeners = new Set<() => void>();
let mockNow = 1_000_000;

jest.mock('expo-audio', () => {
  const {useSyncExternalStore} = jest.requireActual('react');
  const player = {playing: false, playbackRate: 1};
  const subscribe = (listener: () => void) => {
    mockStatusListeners.add(listener);
    return () => mockStatusListeners.delete(listener);
  };
  return {
    createAudioPlayer: () => player,
    useAudioPlayerStatus: () =>
      useSyncExternalStore(subscribe, () => mockStatus),
  };
});

jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {
    initialize: jest.fn(() => Promise.resolve()),
    setPlayer: jest.fn(),
    loadTrack: jest.fn(() => Promise.resolve()),
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(() => Promise.resolve()),
    seekTo: jest.fn(() => Promise.resolve()),
    setRate: jest.fn(),
    cleanup: jest.fn(),
    getPosition: jest.fn(() => mockStatus.currentTime),
    getCurrentTime: jest.fn(() => mockStatus.currentTime),
    getDuration: jest.fn(() => mockStatus.duration),
    getIsLoaded: jest.fn(() => true),
    getIsPlaying: jest.fn(() => mockStatus.playing),
  },
}));
jest.mock('@/services/audio/LockScreenService', () => ({
  lockScreenService: {
    startSync: jest.fn(() => Promise.resolve()),
    stopSync: jest.fn(),
  },
}));
jest.mock('@/services/audio/AmbientAudioService', () => ({
  ambientAudioService: {hasPlayer: () => false, getIsPlaying: () => false},
}));
jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {getActiveSource: () => 'main', mainWillPlay: jest.fn()},
}));
jest.mock('@/services/audio/MushafAudioService', () => ({
  mushafAudioService: {},
}));
jest.mock('@/services/widgets/syncWidgets', () => ({
  markPlayerReadyForWidgets: jest.fn(),
}));
jest.mock('@/services/adhkar/playback/adhkarPlaybackEngine', () => ({
  startAdhkarPlaybackEngine: () => () => undefined,
}));
jest.mock('@/services/widgets/live-activity/syncAdhkarActivity', () => ({
  startAdhkarActivitySync: () => () => undefined,
}));
jest.mock('@/services/adhkar/playback/sessionPersistence', () => ({
  startSessionSaving: () => () => undefined,
  restoreSavedSession: () => Promise.resolve(),
}));
const mockUpdateProgress = jest.fn();
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {
    getState: () => ({
      updateProgress: (...args: unknown[]) => mockUpdateProgress(...args),
      updateUploadProgress: jest.fn(),
    }),
  },
}));
jest.mock('@/store/ambientStore', () => ({
  useAmbientStore: {getState: () => ({isEnabled: false, currentSound: null})},
}));
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: (select: (s: {playbackState: string}) => unknown) =>
    select({playbackState: 'idle'}),
}));

const mockStorage = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockStorage.get(key),
    set: (key: string, value: string) => mockStorage.set(key, value),
    delete: (key: string) => mockStorage.delete(key),
    getAllKeys: () => Array.from(mockStorage.keys()),
  }),
}));
jest.mock('expo-crypto', () => ({randomUUID: () => 'test-device-id'}));
const mockAddListeningTime = jest.fn();
jest.mock('@/services/analytics/LocalAggregationStore', () => ({
  localAggregationStore: {
    getToday: () => '2026-11-14',
    addListeningTime: (...args: unknown[]) => mockAddListeningTime(...args),
    incrementMeaningfulListens: jest.fn(),
    markSurahCompleted: jest.fn(),
  },
}));

import {ExpoAudioProvider} from '../ExpoAudioProvider';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import {useAnalyticsConsentStore} from '@/store/analyticsConsentStore';

const capture = jest.fn();

function track(id: string, surahId: string): Track {
  return {
    id,
    url: `https://cdn.example.com/${id}.mp3`,
    title: `Surah ${surahId}`,
    artist: 'Reciter',
    reciterId: 'reciter-1',
    reciterName: 'Reciter One',
    surahId,
  };
}

/** The playback events that went to PostHog, in order. */
function events(): string[] {
  return capture.mock.calls
    .map(([name]) => name as string)
    .filter(name => name.startsWith('playback_'));
}

function eventProps(name: string): Record<string, unknown>[] {
  return capture.mock.calls
    .filter(([event]) => event === name)
    .map(([, props]) => props as Record<string, unknown>);
}

function listenedTotal(): number {
  return mockAddListeningTime.mock.calls.reduce(
    (sum, [, ms]) => sum + (ms as number),
    0,
  );
}

/** A native status update from expo-audio. */
async function native(patch: Partial<Status>): Promise<void> {
  await act(async () => {
    mockStatus = {...mockStatus, didJustFinish: false, ...patch};
    mockStatusListeners.forEach(listener => listener());
  });
}

async function wait(seconds: number): Promise<void> {
  mockNow += seconds * 1000;
  await native({
    currentTime: mockStatus.playing
      ? mockStatus.currentTime + seconds
      : mockStatus.currentTime,
  });
}

async function storeAction(action: () => Promise<void>): Promise<void> {
  await act(async () => {
    await action();
  });
}

let renderer: ReactTestRenderer | undefined;

/** A queue of surahs 1 and 2 by one reciter, surah 1 playing from 0. */
async function playQueue(durationS: number): Promise<void> {
  await storeAction(() =>
    usePlayerStore
      .getState()
      .updateQueue([track('a', '1'), track('b', '2')], 0),
  );
  await native({isLoaded: true, duration: durationS, currentTime: 0});
  await storeAction(() => usePlayerStore.getState().play());
  await native({playing: true});
}

beforeAll(async () => {
  if (!useAnalyticsConsentStore.persist.hasHydrated()) {
    await new Promise<void>(resolve => {
      const unsub = useAnalyticsConsentStore.persist.onFinishHydration(() => {
        unsub();
        resolve();
      });
    });
  }
  analyticsService.setPostHogInstance({
    capture,
    register: jest.fn(),
    identify: jest.fn(),
    optIn: jest.fn(() => Promise.resolve()),
    optOut: jest.fn(() => Promise.resolve()),
  } as unknown as Parameters<typeof analyticsService.setPostHogInstance>[0]);
});

beforeEach(async () => {
  jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
  mockStatus = {
    isLoaded: false,
    playing: false,
    isBuffering: false,
    currentTime: 0,
    duration: 0,
    didJustFinish: false,
  };
  usePlayerStore.getState().reset();
  await act(async () => {
    renderer = create(
      <ExpoAudioProvider>
        <></>
      </ExpoAudioProvider>,
    );
  });
  capture.mockClear();
  mockAddListeningTime.mockClear();
  mockUpdateProgress.mockClear();
});

afterEach(async () => {
  // Stop the player, so no listened time runs on into the next test.
  await native({playing: false});
  await act(async () => renderer?.unmount());
  jest.restoreAllMocks();
});

it('one finished track in a queue sends completed once, and no paused or skipped', async () => {
  await playQueue(120);
  await wait(119);
  // iOS: the periodic time observer reports the stop first, then the end.
  await native({playing: false, currentTime: 119.6});
  await native({playing: false, currentTime: 120, didJustFinish: true});
  // skipToNext() loaded surah 2; expo-audio reports it playing.
  await native({playing: true, currentTime: 0, duration: 90});

  expect(events()).toEqual([
    'playback_started',
    'playback_completed',
    'playback_started',
  ]);
  expect(eventProps('playback_completed')[0]).toMatchObject({
    surah_id: 1,
    listened_ms: 119_000,
  });
  expect(eventProps('playback_started')[1]).toMatchObject({
    surah_id: 2,
    source: 'autoplay',
  });
  expect(listenedTotal()).toBe(119_000);
});

it('99 s of listening with a 10-minute pause in the middle reports 99 s', async () => {
  await playQueue(99);
  await wait(50);
  await storeAction(() => usePlayerStore.getState().pause());
  await native({playing: false});
  await wait(600);
  await storeAction(() => usePlayerStore.getState().play());
  await native({playing: true});
  await wait(49);
  await native({playing: false, currentTime: 99, didJustFinish: true});

  expect(eventProps('playback_paused')).toEqual([
    expect.objectContaining({listened_ms: 50_000}),
  ]);
  expect(eventProps('playback_completed')).toEqual([
    expect.objectContaining({listened_ms: 99_000, completion_pct: 100}),
  ]);
  expect(listenedTotal()).toBe(99_000);
});

it('a button pause, a button resume and an outside pause each send one event', async () => {
  await playQueue(300);
  await wait(10);

  await storeAction(() => usePlayerStore.getState().pause());
  await native({playing: false});
  expect(events()).toEqual(['playback_started', 'playback_paused']);

  await storeAction(() => usePlayerStore.getState().play());
  await native({playing: true});
  expect(events()).toEqual([
    'playback_started',
    'playback_paused',
    'playback_resumed',
  ]);

  // An interruption, or the lock screen: the store did not ask for it.
  await wait(10);
  await native({playing: false});
  expect(events()).toEqual([
    'playback_started',
    'playback_paused',
    'playback_resumed',
    'playback_paused',
  ]);
});

it('a button pause saves the position at once', async () => {
  await playQueue(300);
  await wait(5);
  await wait(2);
  await storeAction(() => usePlayerStore.getState().pause());
  await native({playing: false});

  const [reciterId, surahId, progress] =
    mockUpdateProgress.mock.calls.at(-1) ?? [];
  expect([reciterId, surahId]).toEqual(['reciter-1', 1]);
  expect(progress).toBeCloseTo(7 / 300);
});

it('a stall is not a pause: iOS reports playing false while it buffers', async () => {
  await playQueue(300);
  await wait(10);
  await native({playing: false, isBuffering: true});
  mockNow += 3000;
  await native({playing: true, isBuffering: false});
  expect(events()).toEqual(['playback_started']);
});

it('repeat one: each loop completes once and starts again as autoplay', async () => {
  usePlayerStore.getState().setRepeatMode('track');
  await playQueue(60);
  await wait(59);
  await native({playing: false, currentTime: 60, didJustFinish: true});
  // The provider seeks to 0 and plays again.
  await native({playing: true, currentTime: 0});
  await wait(59);
  await native({playing: false, currentTime: 60, didJustFinish: true});

  expect(events()).toEqual([
    'playback_started',
    'playback_completed',
    'playback_started',
    'playback_completed',
  ]);
  expect(eventProps('playback_started')[1]).toMatchObject({
    surah_id: 1,
    source: 'autoplay',
  });
  expect(listenedTotal()).toBe(118_000);
});
