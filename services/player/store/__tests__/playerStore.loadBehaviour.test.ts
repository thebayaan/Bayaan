// @ai-generated
/**
 * What a load does around its edges: a pause that lands while it is still
 * in flight, a start position at the very end of the track, the url chosen
 * at load time, tracks added to an empty player, and the sleep timer.
 */

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
    loadTrack: jest.fn(() => Promise.resolve()),
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(() => Promise.resolve()),
    seekTo: jest.fn(() => Promise.resolve()),
    getDuration: jest.fn(() => 120),
    getCurrentTime: jest.fn(() => 0),
    getIsLoaded: jest.fn(() => true),
    isSourceReady: jest.fn(() => true),
    setRate: jest.fn(),
    cleanup: jest.fn(),
  },
}));

jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {mainWillPlay: jest.fn(), pauseMushaf: jest.fn()},
}));

jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    trackPlaybackSkipped: jest.fn(),
    trackPlaybackSeeked: jest.fn(),
    trackRateChanged: jest.fn(),
  },
}));

import {
  usePlayerStore,
  setTrackUrlResolver,
  checkSleepTimer,
} from '../playerStore';
import {expoAudioService} from '@/services/audio/ExpoAudioService';
import {audioCoordinator} from '@/services/audio/AudioCoordinator';
import type {Track} from '@/types/audio';

const audio = expoAudioService as unknown as {
  loadTrack: jest.Mock;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  getDuration: jest.Mock;
};

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

function deferred(): {promise: Promise<void>; resolve: () => void} {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return {promise, resolve};
}

beforeEach(async () => {
  jest.clearAllMocks();
  audio.loadTrack.mockImplementation(() => Promise.resolve());
  audio.getDuration.mockReturnValue(120);
  setTrackUrlResolver(track => track.url);
  await usePlayerStore.getState().cleanup();
  jest.clearAllMocks();
});

describe('a pause that lands while a track is still loading', () => {
  it('is not undone when the load finishes', async () => {
    const load = deferred();
    audio.loadTrack.mockImplementation(() => load.promise);

    const starting = usePlayerStore.getState().updateQueue([makeTrack('a')], 0);
    // The pause button, the sleep timer, or another audio source.
    await usePlayerStore.getState().pause();
    load.resolve();
    await starting;

    expect(audio.play).not.toHaveBeenCalled();
    const state = usePlayerStore.getState();
    expect(state.playback.state).toBe('paused');
    expect(state.loading.trackLoading).toBe(false);
    expect(state.queue.tracks[0]?.id).toBe('a');
  });

  it('the same for the load between two tracks', async () => {
    await usePlayerStore
      .getState()
      .updateQueue([makeTrack('a'), makeTrack('b')], 0);
    audio.play.mockClear();
    const load = deferred();
    audio.loadTrack.mockImplementation(() => load.promise);

    const skipping = usePlayerStore.getState().skipToNext();
    await usePlayerStore.getState().pause();
    load.resolve();
    await skipping;

    expect(audio.play).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().playback.state).toBe('paused');
    expect(usePlayerStore.getState().queue.currentIndex).toBe(1);
  });

  it('a pause from before the load does not hold it back', async () => {
    await usePlayerStore.getState().pause();

    await usePlayerStore.getState().updateQueue([makeTrack('a')], 0);

    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().playback.state).toBe('playing');
  });
});

describe('a start position at the very end of the track', () => {
  it('starts the track from the beginning', async () => {
    // A recent card for a surah that was heard to its end.
    await usePlayerStore.getState().updateQueue([makeTrack('a')], 0, 120);

    expect(audio.seekTo).not.toHaveBeenCalled();
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('a position inside the track is kept', async () => {
    await usePlayerStore.getState().updateQueue([makeTrack('a')], 0, 60);

    expect(audio.seekTo).toHaveBeenCalledWith(60);
  });
});

describe('the url a track is loaded from', () => {
  it('is chosen when the track is loaded, not when the queue was built', async () => {
    const downloaded = new Set<string>();
    setTrackUrlResolver(track =>
      downloaded.has(track.id)
        ? `file:///downloads/${track.id}.mp3`
        : track.url,
    );
    await usePlayerStore
      .getState()
      .updateQueue([makeTrack('a'), makeTrack('b')], 0);
    expect(audio.loadTrack).toHaveBeenLastCalledWith(
      'https://cdn.example.com/a.mp3',
    );

    // "b" is downloaded while "a" plays.
    downloaded.add('b');
    await usePlayerStore.getState().skipToNext();

    expect(audio.loadTrack).toHaveBeenLastCalledWith('file:///downloads/b.mp3');
  });
});

describe('addToQueue() on a player with no current track', () => {
  it('makes the first added track current, paused', async () => {
    await usePlayerStore
      .getState()
      .addToQueue([makeTrack('a'), makeTrack('b')]);

    const state = usePlayerStore.getState();
    expect(state.queue.currentIndex).toBe(0);
    expect(state.queue.tracks.map(t => t.id)).toEqual(['a', 'b']);
    expect(state.playback.state).toBe('paused');
    expect(audio.loadTrack).not.toHaveBeenCalled();
  });

  it('leaves the current track alone when there is one', async () => {
    await usePlayerStore.getState().updateQueue([makeTrack('a')], 0);

    await usePlayerStore.getState().addToQueue([makeTrack('b')]);

    const state = usePlayerStore.getState();
    expect(state.queue.currentIndex).toBe(0);
    expect(state.playback.state).toBe('playing');
  });
});

describe('the sleep timer', () => {
  afterEach(() => {
    usePlayerStore.getState().setSleepTimer(0);
  });

  it('does nothing before its time', async () => {
    await usePlayerStore.getState().updateQueue([makeTrack('a')], 0);
    usePlayerStore.getState().setSleepTimer(10);

    checkSleepTimer(Date.now() + 60_000);

    expect(audio.pause).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().settings.sleepTimerEnd).not.toBeNull();
  });

  it('pauses the recitation and clears itself when its time has come', async () => {
    // Called from a native status update, so it also works where JS timers
    // do not run (Android with the screen off).
    await usePlayerStore.getState().updateQueue([makeTrack('a')], 0);
    usePlayerStore.getState().setSleepTimer(10);

    checkSleepTimer(Date.now() + 11 * 60_000);
    await Promise.resolve();

    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(audioCoordinator.pauseMushaf).toHaveBeenCalledTimes(1);
    const {settings} = usePlayerStore.getState();
    expect(settings.sleepTimerEnd).toBeNull();
    expect(settings.sleepTimer).toBe(0);
    expect(settings.sleepTimerInterval).toBeNull();
  });

  it('a second check in the same moment does nothing more', async () => {
    await usePlayerStore.getState().updateQueue([makeTrack('a')], 0);
    usePlayerStore.getState().setSleepTimer(10);
    const later = Date.now() + 11 * 60_000;

    checkSleepTimer(later);
    checkSleepTimer(later);
    await Promise.resolve();

    expect(audio.pause).toHaveBeenCalledTimes(1);
  });

  it('holds back a track that was loading when it ran out', async () => {
    await usePlayerStore
      .getState()
      .updateQueue([makeTrack('a'), makeTrack('b')], 0);
    audio.play.mockClear();
    usePlayerStore.getState().setSleepTimer(10);
    const load = deferred();
    audio.loadTrack.mockImplementation(() => load.promise);

    const skipping = usePlayerStore.getState().skipToNext();
    checkSleepTimer(Date.now() + 11 * 60_000);
    await Promise.resolve();
    load.resolve();
    await skipping;

    expect(audio.play).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().playback.state).toBe('paused');
  });
});
