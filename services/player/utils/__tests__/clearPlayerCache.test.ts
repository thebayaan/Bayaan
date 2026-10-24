/**
 * @ai Regression tests: Settings -> Clear cache while audio plays.
 *
 * The bug: clearPlayerCache() -> playerStore.cleanup() cleared the queue (the
 * mini-player went away) but did not pause the native player. The audio kept
 * playing with no control in the app to stop it.
 *
 * The contract these tests hold: cleanup() ends in-flight loads, then pauses
 * the native player through expoAudioService.pause(), BEFORE it resets the
 * service and the state. The next track still plays.
 */

jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {
    loadTrack: jest.fn(),
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(() => Promise.resolve()),
    seekTo: jest.fn(() => Promise.resolve()),
    getDuration: jest.fn(() => 120),
    getIsLoaded: jest.fn(() => true),
    getCurrentTime: jest.fn(() => 0),
    getIsPlaying: jest.fn(() => false),
    setRate: jest.fn(),
    cleanup: jest.fn(),
  },
}));

jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {
    mainWillPlay: jest.fn(),
  },
}));

jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    trackPlaybackSkipped: jest.fn(),
    trackPlaybackSeeked: jest.fn(),
    trackRateChanged: jest.fn(),
  },
}));

import {clearPlayerCache} from '../storage';
import {usePlayerStore} from '../../store/playerStore';
import {expoAudioService} from '@/services/audio/ExpoAudioService';
import type {Track} from '@/types/audio';

const mockedAudio = jest.mocked(expoAudioService);

function deferred(): {promise: Promise<void>; resolve: () => void} {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return {promise, resolve};
}

function makeTrack(id: string): Track {
  return {
    id,
    url: `https://cdn.example.com/${id}.mp3`,
    title: `Track ${id}`,
    artist: 'Test Reciter',
    reciterId: 'test-reciter',
    reciterName: 'Test Reciter',
    surahId: '1',
  };
}

// Let awaited continuations run to completion.
const flush = () => new Promise<void>(r => setTimeout(r, 0));

describe('clearPlayerCache() while audio plays', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAudio.loadTrack.mockImplementation(() => Promise.resolve());
    mockedAudio.pause.mockImplementation(() => Promise.resolve());
  });

  it('pauses the player before it resets the service and the queue', async () => {
    await usePlayerStore.getState().updateQueue([makeTrack('a')], 0);
    await flush();
    expect(mockedAudio.play).toHaveBeenCalledTimes(1);

    await clearPlayerCache();

    expect(mockedAudio.pause).toHaveBeenCalledTimes(1);
    expect(mockedAudio.cleanup).toHaveBeenCalledTimes(1);
    // The pause must reach the player before cleanup() resets the service.
    expect(mockedAudio.pause.mock.invocationCallOrder[0]).toBeLessThan(
      mockedAudio.cleanup.mock.invocationCallOrder[0],
    );

    const state = usePlayerStore.getState();
    expect(state.queue.tracks).toHaveLength(0);
    expect(state.queue.currentIndex).toBe(-1);
  });

  it('still resets the queue when the pause fails', async () => {
    await usePlayerStore.getState().updateQueue([makeTrack('a')], 0);
    await flush();
    mockedAudio.pause.mockImplementation(() =>
      Promise.reject(new Error('native pause failed')),
    );

    await expect(clearPlayerCache()).resolves.toBeUndefined();

    expect(mockedAudio.cleanup).toHaveBeenCalledTimes(1);
    const state = usePlayerStore.getState();
    expect(state.queue.tracks).toHaveLength(0);
    expect(state.loading.trackLoading).toBe(false);
  });

  it('plays the next track that the user starts after the clear', async () => {
    await usePlayerStore.getState().updateQueue([makeTrack('a')], 0);
    await flush();
    await clearPlayerCache();
    jest.clearAllMocks();
    mockedAudio.loadTrack.mockImplementation(() => Promise.resolve());

    await usePlayerStore.getState().updateQueue([makeTrack('b')], 0);
    await flush();

    expect(mockedAudio.loadTrack).toHaveBeenCalledWith(
      'https://cdn.example.com/b.mp3',
    );
    expect(mockedAudio.play).toHaveBeenCalledTimes(1);
    const state = usePlayerStore.getState();
    expect(state.playback.state).toBe('ready');
    expect(state.queue.tracks[0]?.id).toBe('b');
  });

  it('does not start audio from a load that is in flight during the clear', async () => {
    const load = deferred();
    mockedAudio.loadTrack.mockImplementation(() => load.promise);

    const updatePromise = usePlayerStore
      .getState()
      .updateQueue([makeTrack('c')], 0);
    await flush();
    expect(mockedAudio.loadTrack).toHaveBeenCalledTimes(1);

    await clearPlayerCache();
    expect(mockedAudio.pause).toHaveBeenCalledTimes(1);

    // The network load completes after the clear.
    load.resolve();
    await updatePromise;
    await flush();

    expect(mockedAudio.play).not.toHaveBeenCalled();
    const state = usePlayerStore.getState();
    expect(state.queue.tracks).toHaveLength(0);
    expect(state.loading.trackLoading).toBe(false);
  });

  it('ends in-flight loads before the pause: a load that finishes during the pause does not play', async () => {
    const load = deferred();
    mockedAudio.loadTrack.mockImplementation(() => load.promise);
    const pause = deferred();
    mockedAudio.pause.mockImplementation(() => pause.promise);

    const updatePromise = usePlayerStore
      .getState()
      .updateQueue([makeTrack('d')], 0);
    await flush();

    const clearPromise = clearPlayerCache();
    await flush();
    expect(mockedAudio.pause).toHaveBeenCalledTimes(1);

    // The load completes while the pause is still in flight.
    load.resolve();
    await updatePromise;
    await flush();
    expect(mockedAudio.play).not.toHaveBeenCalled();

    pause.resolve();
    await clearPromise;

    expect(mockedAudio.play).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().queue.tracks).toHaveLength(0);
  });
});
