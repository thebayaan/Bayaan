// @ai-generated
// A queue in the Android background (#540): the real provider over the real
// player store and the real ExpoAudioService. Only the native player and the
// side services are fakes. Android runs no JS timers in the background, so
// the fake timers here never advance, while the native status updates still
// reach JS. On Android, a source that ends counts as loaded until the next
// source starts to load.
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
// expo-audio hands each listener the new status.
const mockListeners = new Set<(status: Status) => void>();

jest.mock('expo-audio', () => {
  const {useSyncExternalStore} = jest.requireActual('react');
  const subscribe = (listener: (status: Status) => void) => {
    mockListeners.add(listener);
    return () => mockListeners.delete(listener);
  };
  const player = {
    get isLoaded() {
      return mockStatus.isLoaded;
    },
    get playing() {
      return mockStatus.playing;
    },
    playbackRate: 1,
    replace: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    addListener: (_event: string, listener: (status: Status) => void) => {
      const remove = subscribe(listener);
      return {remove};
    },
  };
  return {
    createAudioPlayer: () => player,
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    useAudioPlayerStatus: () =>
      useSyncExternalStore(subscribe, () => mockStatus),
  };
});
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    listenSession: {
      end: jest.fn(),
      start: jest.fn(),
      playingChanged: jest.fn(),
      isOpen: false,
    },
    setTrackDuration: jest.fn(),
    updatePlaybackProgress: jest.fn(),
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
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {
    getState: () => ({
      updateProgress: jest.fn(),
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

import {createAudioPlayer} from 'expo-audio';
import {ExpoAudioProvider} from '../ExpoAudioProvider';
import {usePlayerStore} from '@/services/player/store/playerStore';

const nativePlayer = createAudioPlayer(null) as unknown as {
  replace: jest.Mock;
};

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

/** A native status update from expo-audio. */
async function native(patch: Partial<Status>): Promise<void> {
  await act(async () => {
    mockStatus = {...mockStatus, didJustFinish: false, ...patch};
    mockListeners.forEach(listener => listener(mockStatus));
  });
}

/** The new source loads, and plays on, as ExoPlayer does after an end. */
async function nativeLoads(duration: number): Promise<void> {
  await native({isLoaded: false, isBuffering: true, playing: false});
  await native({
    isLoaded: true,
    isBuffering: false,
    playing: true,
    currentTime: 0,
    duration,
  });
}

/** The current track plays to its end. */
async function nativeEnds(): Promise<void> {
  await native({currentTime: mockStatus.duration});
  await native({playing: false, didJustFinish: true});
}

function loadedUrls(): string[] {
  return nativePlayer.replace.mock.calls.map(([source]) => source.uri);
}

let renderer: ReactTestRenderer | undefined;

beforeEach(async () => {
  jest.useFakeTimers();
  usePlayerStore.getState().reset();
  await act(async () => {
    renderer = create(
      <ExpoAudioProvider>
        <></>
      </ExpoAudioProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  jest.useRealTimers();
});

it('a queue in the background advances at the end of each track', async () => {
  // In the foreground: start a queue of three surahs.
  let started: Promise<void> | undefined;
  await act(async () => {
    started = usePlayerStore
      .getState()
      .updateQueue([track('a', '108'), track('b', '109'), track('c', '110')]);
  });
  await nativeLoads(30);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(100);
    await started;
  });
  expect(loadedUrls()).toEqual(['https://cdn.example.com/a.mp3']);

  // In the background from here: no timer runs.
  await nativeEnds();
  expect(loadedUrls()).toHaveLength(2);
  await nativeLoads(40);
  expect(usePlayerStore.getState().queue.currentIndex).toBe(1);

  await nativeEnds();
  expect(loadedUrls()).toEqual([
    'https://cdn.example.com/a.mp3',
    'https://cdn.example.com/b.mp3',
    'https://cdn.example.com/c.mp3',
  ]);
  await nativeLoads(50);
  expect(usePlayerStore.getState().queue.currentIndex).toBe(2);
  expect(usePlayerStore.getState().playback.state).toBe('playing');
});
