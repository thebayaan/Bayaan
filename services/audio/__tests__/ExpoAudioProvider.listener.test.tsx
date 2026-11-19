// @ai-generated
/**
 * What the provider does with the events the player sends it directly: the
 * end of a track, a source that fails, and the sleep timer running out.
 * These used to be read from React state, which keeps only the latest
 * status: an event followed at once by another was never seen.
 */
import React from 'react';
import {AppState, Platform} from 'react-native';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';

type PlayerEvent = {didJustFinish?: boolean; error?: string | null};
const mockListeners = new Set<(event: PlayerEvent) => void>();
const mockPlayer = {
  id: 'player',
  playbackRate: 1,
  currentStatus: {playing: false, isBuffering: false},
  addListener: jest.fn((_name: string, listener: (e: PlayerEvent) => void) => {
    mockListeners.add(listener);
    return {remove: () => mockListeners.delete(listener)};
  }),
};
let mockStatus = {
  isLoaded: true,
  playing: false,
  isBuffering: false,
  currentTime: 0,
  duration: 120,
  didJustFinish: false,
  timeControlStatus: 'paused',
};

jest.mock('expo-audio', () => ({
  createAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => mockStatus,
}));

const mockAudio = {
  initialize: jest.fn(() => Promise.resolve()),
  setPlayer: jest.fn(),
  play: jest.fn(() => Promise.resolve()),
  pause: jest.fn(() => Promise.resolve()),
  seekTo: jest.fn((_seconds: number) => Promise.resolve()),
  setRate: jest.fn(),
  wantsToPlay: jest.fn(() => false),
};
jest.mock('@/services/audio/ExpoAudioService', () => ({
  // A getter: the factory runs before `mockAudio` is assigned.
  get expoAudioService() {
    return mockAudio;
  },
}));
jest.mock('@/services/audio/LockScreenService', () => ({
  lockScreenService: {startSync: () => Promise.resolve(), stopSync: jest.fn()},
}));
jest.mock('@/services/audio/AmbientAudioService', () => ({
  ambientAudioService: {hasPlayer: () => false, getIsPlaying: () => false},
}));
jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {getActiveSource: () => 'main', mainWillPlay: jest.fn()},
}));
jest.mock('@/services/audio/MushafAudioService', () => ({
  mushafAudioService: {getPlayer: () => null},
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    trackPlaybackCompleted: jest.fn(),
    trackPlaybackStarted: jest.fn(),
    trackPlaybackPaused: jest.fn(),
    trackPlaybackResumed: jest.fn(),
    updatePlaybackProgress: jest.fn(),
    setTrackDuration: jest.fn(),
    // The provider feeds the listen session on each status and track end.
    listenSession: {
      isOpen: false,
      start: jest.fn(),
      end: jest.fn(),
      playingChanged: jest.fn(),
    },
  },
}));

const mockCheckSleepTimer = jest.fn((): boolean => false);
const mockStore = {
  playback: {state: 'playing', rate: 1, position: 0, duration: 120},
  loading: {trackLoading: false},
  settings: {repeatMode: 'none'},
  queue: {
    tracks: [
      {id: 'a', reciterId: 'r', reciterName: 'R', surahId: '2'},
      {id: 'b', reciterId: 'r', reciterName: 'R', surahId: '3'},
    ] as object[],
    currentIndex: 0,
  },
  updatePlaybackState: jest.fn(),
  setError: jest.fn(),
  skipToNext: jest.fn(() => Promise.resolve()),
};
jest.mock('@/services/player/store/playerStore', () => {
  const usePlayerStore = (
    selector: (s: typeof mockStore) => unknown,
  ): unknown => selector(mockStore);
  usePlayerStore.getState = () => mockStore;
  return {usePlayerStore, checkSleepTimer: () => mockCheckSleepTimer()};
});
const mockUpdateProgress = jest.fn();
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {
    getState: () => ({updateProgress: mockUpdateProgress}),
  },
}));
jest.mock('@/store/ambientStore', () => ({
  useAmbientStore: {getState: () => ({isEnabled: false, currentSound: null})},
}));
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: (selector: (s: {playbackState: string}) => unknown) =>
    selector({playbackState: 'idle'}),
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
jest.mock('@/services/widgets/syncWidgets', () => ({
  markPlayerReadyForWidgets: jest.fn(),
}));
const mockReportPlaybackFailed = jest.fn();
jest.mock('@/services/player/utils/playbackFailure', () => ({
  reportPlaybackFailed: () => mockReportPlaybackFailed(),
}));

import {ExpoAudioProvider} from '../ExpoAudioProvider';

let appStateHandler: ((next: string) => void) | null = null;
let renderer: ReactTestRenderer | undefined;

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

async function mount(): Promise<void> {
  await act(async () => {
    renderer = create(<ExpoAudioProvider>{null}</ExpoAudioProvider>);
  });
  await flush();
  jest.clearAllMocks();
}

async function send(event: PlayerEvent): Promise<void> {
  await act(async () => {
    mockListeners.forEach(listener => listener(event));
  });
  await flush();
}

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = {
    isLoaded: true,
    playing: false,
    isBuffering: false,
    currentTime: 0,
    duration: 120,
    didJustFinish: false,
    timeControlStatus: 'paused',
  };
  mockStore.playback = {state: 'playing', rate: 1, position: 0, duration: 120};
  mockStore.loading.trackLoading = false;
  mockStore.settings.repeatMode = 'none';
  mockStore.queue.currentIndex = 0;
  mockCheckSleepTimer.mockReturnValue(false);
  mockAudio.wantsToPlay.mockReturnValue(false);
  appStateHandler = null;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((type: string, listener: (next: never) => void) => {
      if (type === 'change') appStateHandler = listener as (n: string) => void;
      return {remove: jest.fn()} as unknown as ReturnType<
        typeof AppState.addEventListener
      >;
    });
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  await flush();
  renderer = undefined;
  Platform.OS = originalOS;
  jest.restoreAllMocks();
});

describe('a source that fails', () => {
  it('settles the controls and tells the listener when it was playing', async () => {
    mockStore.playback.state = 'buffering';
    await mount();
    await send({error: 'Source error'});
    expect(mockStore.updatePlaybackState).toHaveBeenCalledWith({
      state: 'paused',
      buffering: false,
    });
    expect(mockStore.setError).toHaveBeenCalledTimes(1);
    expect(mockReportPlaybackFailed).toHaveBeenCalledTimes(1);
  });

  // The track restored at launch while offline, a track just added to an
  // empty queue: nothing was asked for, so nothing is reported.
  it('says nothing when the player was paused', async () => {
    mockStore.playback.state = 'paused';
    await mount();
    await send({error: 'Source error'});
    expect(mockReportPlaybackFailed).not.toHaveBeenCalled();
    expect(mockStore.setError).not.toHaveBeenCalled();
  });

  it('leaves a failure during a load to the load itself', async () => {
    mockStore.playback.state = 'loading';
    await mount();
    await send({error: 'Source error'});
    expect(mockReportPlaybackFailed).not.toHaveBeenCalled();
    expect(mockStore.updatePlaybackState).not.toHaveBeenCalled();
  });
});

describe('the end of a track', () => {
  it('goes on to the next surah', async () => {
    await mount();
    await send({didJustFinish: true});
    expect(mockStore.skipToNext).toHaveBeenCalledTimes(1);
    // ...and the surah counts as heard to its end.
    expect(mockUpdateProgress).toHaveBeenCalledWith('r', 2, 1, 120);
  });

  it('does not go on when the sleep timer ran out with it', async () => {
    mockCheckSleepTimer.mockReturnValue(true);
    await mount();
    mockCheckSleepTimer.mockReturnValue(true);
    await send({didJustFinish: true});
    expect(mockStore.skipToNext).not.toHaveBeenCalled();
    expect(mockAudio.play).not.toHaveBeenCalled();
    expect(mockUpdateProgress).toHaveBeenCalledWith('r', 2, 1, 120);
  });

  it('leaves the last track of the queue ended, paused and rewound', async () => {
    mockStore.queue.currentIndex = 1;
    await mount();
    await send({didJustFinish: true});
    expect(mockStore.skipToNext).not.toHaveBeenCalled();
    expect(mockStore.updatePlaybackState).toHaveBeenCalledWith({
      state: 'ended',
    });
    expect(mockAudio.pause).toHaveBeenCalledTimes(1);
    expect(mockAudio.seekTo).toHaveBeenCalledWith(0);
  });
});

describe('leaving the app after the queue has ended', () => {
  it('does not write 0% over the surah that was heard to its end', async () => {
    mockStore.queue.currentIndex = 1;
    mockStore.playback.state = 'ended';
    await mount(); // the last track sits rewound at 0:00
    appStateHandler?.('background');
    expect(mockUpdateProgress).not.toHaveBeenCalled();
  });

  it('still saves where a paused surah stands', async () => {
    mockStore.playback.state = 'paused';
    mockStatus = {...mockStatus, currentTime: 30};
    await mount();
    appStateHandler?.('background');
    expect(mockUpdateProgress).toHaveBeenCalledWith('r', 2, 0.25, 120);
  });
});

describe('Android: play asked for while the player buffers after a seek', () => {
  it('reads as waiting for data, not as paused', async () => {
    Platform.OS = 'android';
    mockAudio.wantsToPlay.mockReturnValue(true);
    mockStatus = {
      ...mockStatus,
      isLoaded: false,
      isBuffering: true,
      playing: false,
    };
    await act(async () => {
      renderer = create(<ExpoAudioProvider>{null}</ExpoAudioProvider>);
    });
    await flush();
    expect(mockStore.updatePlaybackState).toHaveBeenCalledWith({
      state: 'buffering',
    });
  });

  it('a buffering player nobody asked to play stays as it is', async () => {
    Platform.OS = 'android';
    mockStatus = {
      ...mockStatus,
      isLoaded: false,
      isBuffering: true,
      playing: false,
    };
    await act(async () => {
      renderer = create(<ExpoAudioProvider>{null}</ExpoAudioProvider>);
    });
    await flush();
    expect(mockStore.updatePlaybackState).not.toHaveBeenCalledWith({
      state: 'buffering',
    });
  });
});

describe('Android: a stream that stalls', () => {
  it('reads as waiting for data while it is meant to play', async () => {
    Platform.OS = 'android';
    mockAudio.wantsToPlay.mockReturnValue(true);
    mockStatus = {
      ...mockStatus,
      isLoaded: false,
      isBuffering: true,
      playing: true,
    };
    await act(async () => {
      renderer = create(<ExpoAudioProvider>{null}</ExpoAudioProvider>);
    });
    await flush();
    expect(mockStore.updatePlaybackState).toHaveBeenCalledWith({
      state: 'buffering',
    });
  });

  // A pause during a stall changes nothing in Android's status: it goes on
  // reporting the playing from before the stall. A seek of the paused player
  // then showed a spinner and a Pause button.
  it('stays paused when it was paused during the stall', async () => {
    Platform.OS = 'android';
    mockAudio.wantsToPlay.mockReturnValue(false);
    mockStore.playback = {
      state: 'paused',
      rate: 1,
      position: 30,
      duration: 120,
    };
    mockStatus = {
      ...mockStatus,
      isLoaded: false,
      isBuffering: true,
      playing: true,
      currentTime: 90,
    };
    await act(async () => {
      renderer = create(<ExpoAudioProvider>{null}</ExpoAudioProvider>);
    });
    await flush();
    expect(mockStore.updatePlaybackState).not.toHaveBeenCalledWith({
      state: 'buffering',
    });
  });
});
