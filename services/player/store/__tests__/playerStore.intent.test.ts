// @ai-generated
/**
 * The player does what was asked last.
 *
 * Each case here was a way the store ended up doing something else: a play
 * undone by an older pause, a queue that started over after the listener had
 * scrubbed in it, a sleep timer that let the next surah play, a track added
 * to an empty player that the player itself never received.
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
    listenSession: {end: jest.fn()}, // @ai
    trackPlaybackSeeked: jest.fn(),
    trackRateChanged: jest.fn(),
  },
}));

import {usePlayerStore, checkSleepTimer} from '../playerStore';
import {expoAudioService} from '@/services/audio/ExpoAudioService';
import {trackRestoreLoad} from '../../utils/restoreLoad';
import {onPlaybackFailed} from '../../utils/playbackFailure';
import type {Track} from '@/types/audio';

const audio = expoAudioService as unknown as {
  loadTrack: jest.Mock;
  play: jest.Mock;
  pause: jest.Mock;
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

const store = () => usePlayerStore.getState();

/** A loadTrack that stays pending until the returned function is called. */
function holdNextLoad(): () => void {
  let finish: () => void = () => undefined;
  audio.loadTrack.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        finish = resolve;
      }),
  );
  return () => finish();
}

/** The native play / pause calls, in the order they were made. */
function transportCalls(): string[] {
  return [
    ...audio.play.mock.invocationCallOrder.map(o => ['play', o] as const),
    ...audio.pause.mock.invocationCallOrder.map(o => ['pause', o] as const),
  ]
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);
}

const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

beforeEach(async () => {
  await store().cleanup();
  jest.clearAllMocks();
  audio.getDuration.mockReturnValue(120);
  audio.getCurrentTime.mockReturnValue(0);
  audio.isSourceReady.mockReturnValue(true);
  store().setRepeatMode('none');
});

describe('pause and play while a track is loading', () => {
  it('play after a pause wins: the finished load does not pause again', async () => {
    await store().updateQueue([makeTrack('a'), makeTrack('b')], 0);
    jest.clearAllMocks();
    const finishLoad = holdNextLoad();

    const skip = store().skipToNext();
    await store().pause(); // the car, another source, the pause button
    await store().play(); // ...and then play again
    finishLoad();
    await skip;

    const calls = transportCalls();
    expect(calls[calls.length - 1]).toBe('play');
    expect(store().playback.state).toBe('playing');
  });

  it('a pause with no play after it still holds the load back', async () => {
    await store().updateQueue([makeTrack('a'), makeTrack('b')], 0);
    jest.clearAllMocks();
    const finishLoad = holdNextLoad();

    const skip = store().skipToNext();
    await store().pause();
    finishLoad();
    await skip;

    expect(audio.play).not.toHaveBeenCalled();
    expect(store().playback.state).toBe('paused');
  });

  it('pause, play, pause: the last pause holds', async () => {
    await store().updateQueue([makeTrack('a'), makeTrack('b')], 0);
    jest.clearAllMocks();
    const finishLoad = holdNextLoad();

    const skip = store().skipToNext();
    await store().pause();
    await store().play();
    await store().pause();
    finishLoad();
    await skip;

    const calls = transportCalls();
    expect(calls[calls.length - 1]).toBe('pause');
    expect(store().playback.state).toBe('paused');
  });

  it('a pause while play waits for the launch restore is the later request', async () => {
    store().updateQueueState({
      tracks: [makeTrack('a')],
      currentIndex: 0,
      total: 1,
    });
    store().updatePlaybackState({state: 'paused', position: 30, duration: 120});
    let finishRestore: () => void = () => undefined;
    trackRestoreLoad(
      new Promise<void>(resolve => {
        finishRestore = resolve;
      }),
    );

    const playing = store().play();
    await store().pause();
    jest.clearAllMocks();
    finishRestore();
    await playing;

    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.loadTrack).not.toHaveBeenCalled();
    expect(store().playback.state).toBe('paused');
    expect(store().loading.trackLoading).toBe(false);
  });
});

describe('play after the queue has ended', () => {
  function endQueue(tracks: Track[], index: number): void {
    store().updateQueueState({
      tracks,
      currentIndex: index,
      total: tracks.length,
    });
    // What the end of the queue leaves: 'ended', rewound to the start.
    store().updatePlaybackState({state: 'ended', position: 0, duration: 120});
    store().updateLoadingState({trackLoading: false, queueLoading: false});
  }

  it('starts the queue over when nothing was touched', async () => {
    endQueue([makeTrack('a'), makeTrack('b')], 1);
    await store().play();
    expect(store().queue.currentIndex).toBe(0);
    expect(audio.loadTrack).toHaveBeenCalledWith(makeTrack('a').url);
  });

  it('resumes where the slider was dragged to, in the same track', async () => {
    endQueue([makeTrack('a'), makeTrack('b')], 1);

    await store().seekTo(60);
    audio.getCurrentTime.mockReturnValue(60);
    expect(store().playback.state).toBe('paused');
    await store().play();

    expect(store().queue.currentIndex).toBe(1);
    expect(audio.loadTrack).not.toHaveBeenCalled();
    expect(audio.seekTo).toHaveBeenCalledTimes(1); // the drag, no rewind
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(store().playback.state).toBe('playing');
  });

  it('resumes after a seek the store did not make (the lock screen)', async () => {
    endQueue([makeTrack('a')], 0);
    audio.getCurrentTime.mockReturnValue(45); // moved natively; still 'ended'

    await store().play();

    expect(audio.seekTo).not.toHaveBeenCalled();
    expect(audio.loadTrack).not.toHaveBeenCalled();
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('replays a single finished surah from the start', async () => {
    endQueue([makeTrack('a')], 0);
    await store().play();
    expect(audio.seekTo).toHaveBeenCalledWith(0);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });
});

describe('checkSleepTimer()', () => {
  it('says whether the timer ended, and pauses once', async () => {
    await store().updateQueue([makeTrack('a')], 0);
    jest.clearAllMocks();
    const now = Date.now();
    usePlayerStore.setState(state => ({
      settings: {...state.settings, sleepTimerEnd: now + 1000},
    }));

    expect(checkSleepTimer(now)).toBe(false);
    expect(audio.pause).not.toHaveBeenCalled();

    expect(checkSleepTimer(now + 1000)).toBe(true);
    expect(store().settings.sleepTimerEnd).toBeNull();
    // A second caller in the same moment finds no timer.
    expect(checkSleepTimer(now + 1000)).toBe(false);
    await flush();
    expect(audio.pause).toHaveBeenCalledTimes(1);
  });
});

describe('addToQueue() on a player with no current track', () => {
  it('hands the first added track to the player, paused', async () => {
    await store().addToQueue([makeTrack('x'), makeTrack('y')]);
    await flush();

    expect(audio.loadTrack).toHaveBeenCalledTimes(1);
    expect(audio.loadTrack).toHaveBeenCalledWith(makeTrack('x').url);
    expect(audio.play).not.toHaveBeenCalled();
    expect(store().queue.currentIndex).toBe(0);
    expect(store().playback.state).toBe('paused');
  });

  it('says nothing when that load fails, and the next play retries it', async () => {
    const failures = jest.fn();
    const unsubscribe = onPlaybackFailed(failures);
    audio.loadTrack.mockRejectedValueOnce(new Error('offline'));

    await store().addToQueue([makeTrack('x')]);
    await flush();
    expect(failures).not.toHaveBeenCalled();
    expect(store().playback.state).toBe('paused');

    // The player holds nothing playable: play loads the track again.
    audio.isSourceReady.mockReturnValue(false);
    await store().play();
    expect(audio.loadTrack).toHaveBeenCalledTimes(2);
    expect(store().playback.state).toBe('playing');
    unsubscribe();
  });

  it('loads nothing when the player already has a current track', async () => {
    await store().updateQueue([makeTrack('a')], 0);
    jest.clearAllMocks();
    await store().addToQueue([makeTrack('b')]);
    await flush();
    expect(audio.loadTrack).not.toHaveBeenCalled();
  });
});

describe('removeFromQueue() of the current track while it waits for data', () => {
  it('plays the track that replaces it: buffering is a player that wants to play', async () => {
    await store().updateQueue([makeTrack('a'), makeTrack('b')], 0);
    store().updatePlaybackState({state: 'buffering'});
    jest.clearAllMocks();

    await store().removeFromQueue([0]);

    expect(audio.loadTrack).toHaveBeenCalledWith(makeTrack('b').url);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(store().playback.state).toBe('playing');
  });
});

describe('updateQueue() at a start position at the end of the track', () => {
  it('shows the start, where the load put it', async () => {
    await store().updateQueue([makeTrack('a')], 0, 119.9);
    expect(audio.seekTo).not.toHaveBeenCalled();
    expect(store().playback.position).toBe(0);
  });
});
