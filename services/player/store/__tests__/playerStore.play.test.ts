// @ai-generated
/**
 * play() used to be a bare native play(). That is silent, while the controls
 * show playing, whenever the player does not hold a playable source: after a
 * launch whose restore could not load, after a failed load, and at the end
 * of a track or of the queue. These tests pin what play() does in each case.
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
  audioCoordinator: {mainWillPlay: jest.fn()},
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
import {trackRestoreLoad} from '../../utils/restoreLoad';
import {onPlaybackFailed} from '../../utils/playbackFailure';
import type {Track} from '@/types/audio';

const audio = expoAudioService as unknown as {
  loadTrack: jest.Mock;
  play: jest.Mock;
  seekTo: jest.Mock;
  getDuration: jest.Mock;
  getCurrentTime: jest.Mock;
  isSourceReady: jest.Mock;
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

/** Puts the store where a paused session would be. */
function seed(
  tracks: Track[],
  currentIndex: number,
  playback: {position?: number; duration?: number; state?: 'paused' | 'ended'},
): void {
  const store = usePlayerStore.getState();
  store.updateQueueState({tracks, currentIndex, total: tracks.length});
  store.updatePlaybackState({
    state: playback.state ?? 'paused',
    position: playback.position ?? 0,
    duration: playback.duration ?? 120,
  });
  store.updateLoadingState({trackLoading: false, queueLoading: false});
  store.setRepeatMode('none');
}

describe('playerStore.play()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    audio.loadTrack.mockImplementation(() => Promise.resolve());
    audio.isSourceReady.mockReturnValue(true);
    audio.getCurrentTime.mockReturnValue(30);
    audio.getDuration.mockReturnValue(120);
  });

  it('resumes a loaded, unfinished track without reloading it', async () => {
    seed([makeTrack('a'), makeTrack('b')], 0, {position: 30});

    await usePlayerStore.getState().play();

    expect(audio.loadTrack).not.toHaveBeenCalled();
    expect(audio.seekTo).not.toHaveBeenCalled();
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().playback.state).toBe('playing');
  });

  it('loads the current track where it was left when nothing playable is loaded', async () => {
    // What a launch looks like when its restore could not load (offline).
    audio.isSourceReady.mockReturnValue(false);
    seed([makeTrack('a'), makeTrack('b')], 0, {position: 45, duration: 300});

    await usePlayerStore.getState().play();

    expect(audio.loadTrack).toHaveBeenCalledWith(
      'https://cdn.example.com/a.mp3',
    );
    expect(audio.seekTo).toHaveBeenCalledWith(45);
    expect(audio.play).toHaveBeenCalledTimes(1);
    const state = usePlayerStore.getState();
    expect(state.playback.state).toBe('playing');
    expect(state.queue.currentIndex).toBe(0);
    expect(state.loading.trackLoading).toBe(false);
  });

  it('starts the queue again after it has ended', async () => {
    audio.getCurrentTime.mockReturnValue(120);
    seed([makeTrack('a'), makeTrack('b'), makeTrack('c')], 2, {
      state: 'ended',
      position: 120,
    });

    await usePlayerStore.getState().play();

    expect(audio.loadTrack).toHaveBeenCalledWith(
      'https://cdn.example.com/a.mp3',
    );
    expect(audio.play).toHaveBeenCalledTimes(1);
    const state = usePlayerStore.getState();
    expect(state.queue.currentIndex).toBe(0);
    expect(state.playback.state).toBe('playing');
    expect(state.playback.position).toBe(0);
  });

  it('rewinds a one-track queue that has ended instead of reloading it', async () => {
    audio.getCurrentTime.mockReturnValue(120);
    seed([makeTrack('a')], 0, {state: 'ended', position: 120});

    await usePlayerStore.getState().play();

    expect(audio.loadTrack).not.toHaveBeenCalled();
    expect(audio.seekTo).toHaveBeenCalledWith(0);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().playback.state).toBe('playing');
  });

  it('goes on to the next track when the current one sits at its end', async () => {
    // A restored session whose surah had finished: the player is at the end.
    audio.getCurrentTime.mockReturnValue(119.8);
    seed([makeTrack('a'), makeTrack('b')], 0, {position: 119.8});

    await usePlayerStore.getState().play();

    expect(audio.loadTrack).toHaveBeenCalledWith(
      'https://cdn.example.com/b.mp3',
    );
    const state = usePlayerStore.getState();
    expect(state.queue.currentIndex).toBe(1);
    expect(state.playback.position).toBe(0);
  });

  it('replays the track at its end when repeat-one is on', async () => {
    audio.getCurrentTime.mockReturnValue(120);
    seed([makeTrack('a'), makeTrack('b')], 0, {position: 120});
    usePlayerStore.getState().setRepeatMode('track');

    await usePlayerStore.getState().play();

    expect(audio.loadTrack).not.toHaveBeenCalled();
    expect(audio.seekTo).toHaveBeenCalledWith(0);
    expect(usePlayerStore.getState().queue.currentIndex).toBe(0);
  });

  it('waits for the launch restore before it decides what to load', async () => {
    let finishRestore!: () => void;
    trackRestoreLoad(
      new Promise<void>(resolve => {
        finishRestore = resolve;
      }),
    );
    seed([makeTrack('a')], 0, {position: 30});

    const playing = usePlayerStore.getState().play();
    await new Promise<void>(r => setTimeout(r, 0));
    expect(audio.play).not.toHaveBeenCalled();

    finishRestore();
    await playing;
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('a load that fails leaves the controls paused and reports it', async () => {
    audio.isSourceReady.mockReturnValue(false);
    audio.loadTrack.mockRejectedValue(new Error('offline'));
    const reported = jest.fn();
    const stop = onPlaybackFailed(reported);
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    seed([makeTrack('a')], 0, {position: 10});

    await usePlayerStore.getState().play();

    const state = usePlayerStore.getState();
    expect(state.playback.state).toBe('paused');
    expect(state.loading.trackLoading).toBe(false);
    expect(state.error.playback?.message).toBe('offline');
    expect(reported).toHaveBeenCalledTimes(1);
    stop();
    consoleError.mockRestore();
  });
});

describe('playerStore: loads that fail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    audio.isSourceReady.mockReturnValue(true);
  });

  it('updateQueue() does not leave the store loading', async () => {
    audio.loadTrack.mockRejectedValue(new Error('dead link'));
    const reported = jest.fn();
    const stop = onPlaybackFailed(reported);
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await usePlayerStore.getState().updateQueue([makeTrack('a')], 0);

    const state = usePlayerStore.getState();
    expect(state.playback.state).toBe('paused');
    expect(state.loading.trackLoading).toBe(false);
    expect(state.loading.queueLoading).toBe(false);
    expect(reported).toHaveBeenCalledTimes(1);
    stop();
    consoleError.mockRestore();
  });

  it('skipToNext() does not leave the store loading', async () => {
    audio.loadTrack.mockResolvedValue(undefined);
    await usePlayerStore
      .getState()
      .updateQueue([makeTrack('a'), makeTrack('b')], 0);
    audio.loadTrack.mockRejectedValue(new Error('dead link'));
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await usePlayerStore.getState().skipToNext();

    const state = usePlayerStore.getState();
    expect(state.playback.state).toBe('paused');
    expect(state.loading.trackLoading).toBe(false);
    consoleError.mockRestore();
  });

  it('a failed load that a newer one superseded is not reported', async () => {
    let failFirst!: (error: Error) => void;
    audio.loadTrack
      .mockImplementationOnce(
        () =>
          new Promise<void>((_, reject) => {
            failFirst = reject;
          }),
      )
      .mockImplementationOnce(() => Promise.resolve());
    const reported = jest.fn();
    const stop = onPlaybackFailed(reported);

    const first = usePlayerStore.getState().updateQueue([makeTrack('a')], 0);
    const second = usePlayerStore.getState().updateQueue([makeTrack('b')], 0);
    failFirst(new Error('offline'));
    await Promise.all([first, second]);

    const state = usePlayerStore.getState();
    expect(reported).not.toHaveBeenCalled();
    expect(state.queue.tracks[0]?.id).toBe('b');
    expect(state.playback.state).toBe('playing');
    stop();
  });
});

describe('playerStore.skipToNext() on the last track', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    audio.loadTrack.mockImplementation(() => Promise.resolve());
  });

  it('changes nothing: the last track keeps playing', async () => {
    await usePlayerStore
      .getState()
      .updateQueue([makeTrack('a'), makeTrack('b')], 1);
    audio.loadTrack.mockClear();

    await usePlayerStore.getState().skipToNext();

    const state = usePlayerStore.getState();
    expect(audio.loadTrack).not.toHaveBeenCalled();
    expect(state.queue.currentIndex).toBe(1);
    expect(state.playback.state).toBe('playing');
  });
});
