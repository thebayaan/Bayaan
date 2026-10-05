/**
 * Regression tests for the in-flight load race in playerStore.
 *
 * The race: updateQueue() optimistically writes the queue, then awaits
 * loadTrackAtIndex() → expoAudioService.loadTrack() (network-bound). Anything
 * that lands during that window races the still-in-flight load — a second
 * play/queue tap (rapid skip, re-queue) or a cleanup() teardown. Without a
 * guard the stale load still fires play() and its caller's trailing set() then
 * clobbers whatever the newer action wrote: audible audio that disagrees with
 * the store (the older track playing over a queue that says the newer one, or
 * playback resuming into a service that has already been torn down).
 *
 * The fix is a monotonic playOpId: loadTrackAtIndex claims an id at entry and
 * re-checks it after each await; cleanup() bumps it; callers skip their
 * trailing state writes when the load reports it was superseded.
 */

// Self-contained in-memory AsyncStorage so the persisted store rehydrates
// cleanly under jest, independent of any global setup.
jest.mock('@react-native-async-storage/async-storage', () => {
  const mem = new Map<string, string>();
  return {
    getItem: jest.fn((k: string) => Promise.resolve(mem.get(k) ?? null)),
    setItem: jest.fn((k: string, v: string) => {
      mem.set(k, v);
      return Promise.resolve();
    }),
    removeItem: jest.fn((k: string) => {
      mem.delete(k);
      return Promise.resolve();
    }),
  };
});

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

import {usePlayerStore} from '../playerStore';
import {expoAudioService} from '@/services/audio/ExpoAudioService';
import type {Track} from '@/types/audio';

const mockedAudio = expoAudioService as unknown as {
  loadTrack: jest.Mock;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  getDuration: jest.Mock;
  cleanup: jest.Mock;
};

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
  } as unknown as Track;
}

// Flush the microtask queue so awaited continuations run to completion.
const flush = () => new Promise<void>(r => setTimeout(r, 0));

describe('playerStore in-flight load race', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAudio.loadTrack.mockImplementation(() => Promise.resolve());
  });

  it("cleanup() during updateQueue()'s network load wins: no play(), state stays reset, queue stays empty", async () => {
    const load = deferred();
    mockedAudio.loadTrack.mockImplementation(() => load.promise);

    const store = usePlayerStore.getState();
    // Kick off the play; it parks awaiting loadTrack (the network).
    const updatePromise = store.updateQueue([makeTrack('a')], 0);
    await flush();
    expect(mockedAudio.loadTrack).toHaveBeenCalledTimes(1);

    // Teardown lands while the load is in flight.
    await usePlayerStore.getState().cleanup();
    expect(mockedAudio.cleanup).toHaveBeenCalled();

    // The network load now completes — too late.
    load.resolve();
    await updatePromise;
    await flush();

    // The core of the race: play() must NOT fire into a torn-down service…
    expect(mockedAudio.play).not.toHaveBeenCalled();
    // …and updateQueue's trailing set() must not clobber cleanup()'s reset.
    const state = usePlayerStore.getState();
    expect(state.playback.state).toBe('none');
    expect(state.queue.tracks).toHaveLength(0);
    expect(state.queue.currentIndex).toBe(-1);
    expect(state.loading.trackLoading).toBe(false);
    expect(state.loading.queueLoading).toBe(false);
  });

  it('a normal updateQueue() still loads, plays, and finalizes', async () => {
    const store = usePlayerStore.getState();
    await store.updateQueue([makeTrack('b')], 0);
    await flush();

    expect(mockedAudio.loadTrack).toHaveBeenCalledTimes(1);
    expect(mockedAudio.play).toHaveBeenCalledTimes(1);
    const state = usePlayerStore.getState();
    expect(state.playback.state).toBe('ready');
    expect(state.queue.tracks).toHaveLength(1);
    expect(state.queue.currentIndex).toBe(0);
    expect(state.loading.trackLoading).toBe(false);
  });

  it('a newer updateQueue() supersedes an older in-flight one (last tap wins, single play())', async () => {
    const first = deferred();
    const second = deferred();
    mockedAudio.loadTrack
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const store = usePlayerStore.getState();
    const p1 = store.updateQueue([makeTrack('one')], 0);
    await flush();
    const p2 = store.updateQueue([makeTrack('two')], 0);
    await flush();

    // Older load resolves after being superseded — must not play.
    first.resolve();
    await p1;
    await flush();
    expect(mockedAudio.play).not.toHaveBeenCalled();

    second.resolve();
    await p2;
    await flush();
    expect(mockedAudio.play).toHaveBeenCalledTimes(1);

    const state = usePlayerStore.getState();
    expect(state.playback.state).toBe('ready');
    expect(state.queue.tracks[0]?.id).toBe('two');
  });
});
