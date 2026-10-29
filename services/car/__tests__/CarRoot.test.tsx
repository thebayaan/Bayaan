import React from 'react';
import {act, create, ReactTestRenderer} from 'react-test-renderer';

const mockPlayer = {id: 'shared-player'};
const mockCreateAudioPlayer = jest.fn(() => mockPlayer);
const mockSetPlayer = jest.fn();
const mockStartSync = jest.fn(() => Promise.resolve());
const mockStopSync = jest.fn();
const mockBootApp = jest.fn(() => Promise.resolve());
const mockStopWidgetSync = jest.fn(); // @ai

jest.mock('expo-audio', () => ({
  createAudioPlayer: () => mockCreateAudioPlayer(),
  useAudioPlayerStatus: () => ({
    isLoaded: false,
    playing: false,
    currentTime: 0,
    duration: 0,
    didJustFinish: false,
  }),
}));
jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {
    initialize: () => Promise.resolve(),
    setPlayer: (player: unknown) => mockSetPlayer(player),
  },
}));
jest.mock('@/services/audio/LockScreenService', () => ({
  lockScreenService: {
    startSync: () => mockStartSync(),
    stopSync: () => mockStopSync(),
  },
}));
jest.mock('@/services/audio/AmbientAudioService', () => ({
  ambientAudioService: {
    hasPlayer: () => false,
    getIsPlaying: () => false,
  },
}));
jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {getActiveSource: () => 'main', mainWillPlay: jest.fn()},
}));
jest.mock('@/services/audio/MushafAudioService', () => ({
  mushafAudioService: {getPlayer: () => null},
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {},
}));
jest.mock('@/services/player/store/playerStore', () => {
  const state = {
    playback: {state: 'idle', rate: 1},
    queue: {tracks: [], currentIndex: 0},
    updatePlaybackState: jest.fn(),
    skipToNext: jest.fn(),
  };
  const usePlayerStore = (selector: (s: typeof state) => unknown): unknown =>
    selector(state);
  usePlayerStore.getState = () => state;
  return {usePlayerStore};
});
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {getState: () => ({})},
}));
jest.mock('@/store/ambientStore', () => ({
  useAmbientStore: {getState: () => ({isEnabled: false, currentSound: null})},
}));
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: (selector: (s: {playbackState: string}) => unknown) =>
    selector({playbackState: 'idle'}),
}));
jest.mock('@/services/appBoot', () => ({
  bootApp: () => mockBootApp(),
}));
jest.mock('@/services/widgets/syncWidgets', () => ({
  markPlayerReadyForWidgets: jest.fn(),
  startWidgetSync: () => mockStopWidgetSync, // @ai
}));
// @ai-start
jest.mock('@/services/widgets/syncConfiguredWidgets', () => ({
  startConfiguredWidgetSync: () => mockStopWidgetSync,
}));
jest.mock('@/services/widgets/syncContentWidgets', () => ({
  startContentWidgetSync: () => mockStopWidgetSync,
}));
// @ai-end

import {ExpoAudioProvider} from '@/services/audio/ExpoAudioProvider';
import {CarRoot} from '@/services/car/CarRoot';

function PhoneLayout(): React.JSX.Element {
  return <ExpoAudioProvider>{null}</ExpoAudioProvider>;
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

describe('CarRoot handover', () => {
  beforeEach(() => {
    // mockCreateAudioPlayer is deliberately not cleared: the shared player
    // lives at module level, so the whole file creates it exactly once.
    mockSetPlayer.mockClear();
    mockStartSync.mockClear();
    mockStopSync.mockClear();
    mockBootApp.mockClear();
  });

  it('boots the app and owns the player while the phone layout is closed', async () => {
    let car: ReactTestRenderer | undefined;
    await act(async () => {
      car = create(<CarRoot />);
    });
    await flush();
    expect(mockBootApp).toHaveBeenCalledTimes(1);
    expect(mockSetPlayer).toHaveBeenCalledWith(mockPlayer);
    expect(mockStartSync).toHaveBeenCalledTimes(1);
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
    await act(async () => car?.unmount());
    await flush();
    expect(mockStopSync).toHaveBeenCalledTimes(1);
  });

  it('steps aside for the phone layout and takes the player back after it closes', async () => {
    let car: ReactTestRenderer | undefined;
    await act(async () => {
      car = create(<CarRoot />);
    });
    await flush();
    expect(mockStartSync).toHaveBeenCalledTimes(1);

    let phone: ReactTestRenderer | undefined;
    await act(async () => {
      phone = create(<PhoneLayout />);
    });
    await flush();
    // The phone's provider attached; the car root unmounted its provider, but
    // sync stays on for the phone's.
    expect(mockSetPlayer).toHaveBeenCalledTimes(2);
    expect(mockStopSync).not.toHaveBeenCalled();
    expect(mockStartSync).toHaveBeenCalledTimes(1);
    // Same player throughout: audio is never released or recreated.
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
    expect(new Set(mockSetPlayer.mock.calls.map(c => c[0]))).toEqual(
      new Set([mockPlayer]),
    );

    await act(async () => phone?.unmount());
    await flush();
    // The car root's provider remounted (attached again) before sync stopped.
    expect(mockSetPlayer).toHaveBeenCalledTimes(3);
    expect(mockStopSync).not.toHaveBeenCalled();
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);

    await act(async () => car?.unmount());
    await flush();
    expect(mockStopSync).toHaveBeenCalledTimes(1);
  });
});
