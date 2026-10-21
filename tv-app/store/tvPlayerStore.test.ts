import {
  describeError,
  hasNextIn,
  PLAYBACK_FAILED_MESSAGE,
  setEndOfTrackHook,
  useTVPlayerStore,
} from './tvPlayerStore';
import type {AudioEngine, EngineEvent} from '../services/audioEngine';
import {
  DEFAULT_RECITER_KEY,
  getDefaultReciter,
  seedDefaultReciter,
} from '../services/tvDataService';
import {normalizeReciters} from '../services/normalizeReciter';
import {storage} from '../services/storage';
import {
  getContinueListening,
  recordProgress,
} from '../services/continueListeningStore';

function volumeOf(engine: AudioEngine): jest.Mock {
  return engine.setVolume as jest.Mock;
}

function lastVolume(engine: AudioEngine): number | undefined {
  const calls = volumeOf(engine).mock.calls;
  return calls.length > 0 ? calls[calls.length - 1][0] : undefined;
}

function makeMockEngine(): AudioEngine & {emit: (e: EngineEvent) => void} {
  let listener: ((e: EngineEvent) => void) | null = null;
  return {
    load: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    seek: jest.fn(),
    setRate: jest.fn(),
    setVolume: jest.fn(),
    destroy: jest.fn(),
    subscribe: cb => {
      listener = cb;
      return () => {
        listener = null;
      };
    },
    emit: e => listener?.(e),
  };
}

const queue = [
  {
    reciterId: 'r1',
    rewayahId: 'w1',
    surahNumber: 1,
    audioUrl: 'https://x/001.mp3',
    title: 'Al-Fatihah',
    subtitle: 'al-Afasy',
  },
  {
    reciterId: 'r1',
    rewayahId: 'w1',
    surahNumber: 2,
    audioUrl: 'https://x/002.mp3',
    title: 'Al-Baqarah',
    subtitle: 'al-Afasy',
  },
  {
    reciterId: 'r1',
    rewayahId: 'w1',
    surahNumber: 3,
    audioUrl: 'https://x/003.mp3',
    title: 'Aal-Imran',
    subtitle: 'al-Afasy',
  },
];

describe('tvPlayerStore', () => {
  beforeEach(() => {
    useTVPlayerStore.getState().reset();
  });

  it('starts idle with empty queue', () => {
    const s = useTVPlayerStore.getState();
    expect(s.status).toBe('idle');
    expect(s.queue).toEqual([]);
  });

  it('loadQueue loads first item and plays', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    expect(engine.load).toHaveBeenCalledWith('https://x/001.mp3');
    expect(engine.play).toHaveBeenCalled();
    expect(useTVPlayerStore.getState().currentIndex).toBe(0);
  });

  it('next advances index and loads next track', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    await useTVPlayerStore.getState().next();
    expect(useTVPlayerStore.getState().currentIndex).toBe(1);
    expect(engine.load).toHaveBeenLastCalledWith('https://x/002.mp3');
  });

  it('next at end with repeat=off stays put', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 2);
    await useTVPlayerStore.getState().next();
    expect(useTVPlayerStore.getState().currentIndex).toBe(2);
  });

  it('next at end with repeat=all wraps to 0', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 2);
    useTVPlayerStore.getState().setRepeat('all');
    await useTVPlayerStore.getState().next();
    expect(useTVPlayerStore.getState().currentIndex).toBe(0);
  });

  it('prev within first 3 seconds goes to previous track', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 2);
    engine.emit({status: 'playing', positionSeconds: 1, durationSeconds: 60});
    await useTVPlayerStore.getState().prev();
    expect(useTVPlayerStore.getState().currentIndex).toBe(1);
  });

  it('prev after 3 seconds restarts current track', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 1);
    engine.emit({status: 'playing', positionSeconds: 10, durationSeconds: 60});
    await useTVPlayerStore.getState().prev();
    expect(useTVPlayerStore.getState().currentIndex).toBe(1);
    expect(engine.seek).toHaveBeenCalledWith(0);
  });

  it('seekBy(15) calls engine.seek with position + 15', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    engine.emit({status: 'playing', positionSeconds: 20, durationSeconds: 60});
    useTVPlayerStore.getState().seekBy(15);
    expect(engine.seek).toHaveBeenCalledWith(35);
  });

  it('toggle pauses when playing', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    engine.emit({status: 'playing', positionSeconds: 5, durationSeconds: 60});
    useTVPlayerStore.getState().toggle();
    expect(engine.pause).toHaveBeenCalled();
  });

  it('auto-advances when engine emits status=idle at end of track', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    engine.emit({
      status: 'playing',
      positionSeconds: 59.9,
      durationSeconds: 60,
    });
    engine.emit({status: 'idle', positionSeconds: 60, durationSeconds: 60});
    await new Promise(r => setTimeout(r, 10));
    expect(useTVPlayerStore.getState().currentIndex).toBe(1);
  });

  it('loadQueue plays in order unless it asks for shuffle', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0, {shuffle: true});
    expect(useTVPlayerStore.getState().shuffle).toBe(true);
    await useTVPlayerStore.getState().loadQueue(queue, 1);
    expect(useTVPlayerStore.getState().shuffle).toBe(false);
  });

  it('loadQueue with startSeconds seeks before playing', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 1, {startSeconds: 42});
    expect(engine.seek).toHaveBeenCalledWith(42);
    expect((engine.seek as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (engine.play as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it('a load replaced by a newer one neither plays nor reports its error', async () => {
    const engine = makeMockEngine();
    let failFirst: (e: Error) => void = () => {};
    (engine.load as jest.Mock).mockImplementationOnce(
      () => new Promise<void>((_, reject) => (failFirst = reject)),
    );
    useTVPlayerStore.getState().setEngine(engine);
    const first = useTVPlayerStore.getState().loadQueue(queue, 0);
    await useTVPlayerStore.getState().loadQueue(queue, 2);
    failFirst(new Error('Network request failed'));
    await first;
    const s = useTVPlayerStore.getState();
    expect(s.currentIndex).toBe(2);
    expect(s.status).not.toBe('error');
    expect(engine.play).toHaveBeenCalledTimes(1);
  });

  it('the last surah ending marks the queue finished; play starts it again', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 2);
    engine.emit({
      status: 'playing',
      positionSeconds: 59.8,
      durationSeconds: 60,
    });
    engine.emit({status: 'idle', positionSeconds: 60, durationSeconds: 60});
    expect(useTVPlayerStore.getState().finished).toBe(true);
    expect(useTVPlayerStore.getState().currentIndex).toBe(2);
    (engine.play as jest.Mock).mockClear();
    useTVPlayerStore.getState().toggle();
    expect(engine.seek).toHaveBeenLastCalledWith(0);
    expect(engine.play).toHaveBeenCalled();
    expect(useTVPlayerStore.getState().finished).toBe(false);
  });

  it('a surah heard to the end leaves Continue listening', async () => {
    storage.clearAll();
    recordProgress({
      reciterId: 'r1',
      rewayahId: 'w1',
      surahNumber: 1,
      positionSeconds: 30,
      durationSeconds: 600,
    });
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    engine.emit({
      status: 'playing',
      positionSeconds: 599.8,
      durationSeconds: 600,
    });
    engine.emit({status: 'idle', positionSeconds: 600, durationSeconds: 600});
    expect(getContinueListening()).toEqual([]);
  });

  it('toggle after an error retries the track', async () => {
    const engine = makeMockEngine();
    (engine.load as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 1);
    expect(useTVPlayerStore.getState().status).toBe('error');
    useTVPlayerStore.getState().toggle();
    await new Promise(r => setTimeout(r, 0));
    expect(engine.load).toHaveBeenCalledTimes(2);
    expect(engine.load).toHaveBeenLastCalledWith('https://x/002.mp3');
  });

  it('while pending, the old track is paused and its events ignored', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    const retry = jest.fn();
    const token = useTVPlayerStore
      .getState()
      .beginPending({...queue[1], audioUrl: ''}, retry);
    expect(engine.pause).toHaveBeenCalled();
    engine.emit({status: 'paused', positionSeconds: 12, durationSeconds: 60});
    expect(useTVPlayerStore.getState().status).toBe('loading');
    useTVPlayerStore.getState().failPending(token, 'Offline');
    expect(useTVPlayerStore.getState().status).toBe('error');
    expect(useTVPlayerStore.getState().lastError).toBe('Offline');
    await useTVPlayerStore.getState().retry();
    expect(retry).toHaveBeenCalled();
  });

  it('failPending is ignored once a newer load started', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    const token = useTVPlayerStore
      .getState()
      .beginPending({...queue[0], audioUrl: ''}, () => {});
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    useTVPlayerStore.getState().failPending(token, 'late');
    expect(useTVPlayerStore.getState().status).not.toBe('error');
  });

  it('setSpeed calls engine.setRate', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    useTVPlayerStore.getState().setSpeed(1.5);
    expect(engine.setRate).toHaveBeenCalledWith(1.5);
  });

  it('setEngine replacing an engine calls destroy on the prior one', () => {
    const engineA = {...makeMockEngine(), destroy: jest.fn()};
    const engineB = {...makeMockEngine(), destroy: jest.fn()};
    useTVPlayerStore.getState().setEngine(engineA);
    useTVPlayerStore.getState().setEngine(engineB);
    expect(engineA.destroy).toHaveBeenCalled();
  });
});

describe('getDefaultReciter', () => {
  it('returns null for an empty reciter list', () => {
    expect(getDefaultReciter([])).toBeNull();
  });

  it('prefers a featured reciter when one exists', () => {
    const reciters = normalizeReciters([
      {id: 'a', name: 'Alpha'},
      {id: 'b', name: 'Beta', is_featured: true},
      {id: 'c', name: 'Gamma'},
    ]);
    expect(getDefaultReciter(reciters)?.id).toBe('b');
  });

  it('falls back to the first reciter when none are featured', () => {
    const reciters = normalizeReciters([
      {id: 'a', name: 'Alpha'},
      {id: 'b', name: 'Beta'},
    ]);
    expect(getDefaultReciter(reciters)?.id).toBe('a');
  });
});

describe('seedDefaultReciter', () => {
  beforeEach(() => {
    storage.clearAll();
  });

  it('resolves and persists a default reciter from the stored catalog', async () => {
    expect(storage.getString(DEFAULT_RECITER_KEY)).toBeUndefined();
    storage.set(
      'bayaan_reciters',
      JSON.stringify({
        version: '4',
        data: [{id: 'a', name: 'Alpha', rewayat: []}],
        savedAt: Date.now(),
      }),
    );
    const id = await seedDefaultReciter();
    expect(id).toBe('a');
    expect(storage.getString(DEFAULT_RECITER_KEY)).toBe(id);
  });

  it('seeds nothing offline before the catalog has ever loaded', async () => {
    const saved = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    expect(await seedDefaultReciter()).toBeNull();
    expect(storage.getString(DEFAULT_RECITER_KEY)).toBeUndefined();
    global.fetch = saved;
  });

  it('does not overwrite an already-persisted default reciter', async () => {
    storage.set(DEFAULT_RECITER_KEY, 'existing-id');
    const id = await seedDefaultReciter();
    expect(id).toBe('existing-id');
    expect(storage.getString(DEFAULT_RECITER_KEY)).toBe('existing-id');
  });

  it("fades the volume over the sleep timer's last 30 seconds, then pauses", () => {
    jest.useFakeTimers();
    try {
      const engine = makeMockEngine();
      useTVPlayerStore.getState().setEngine(engine);
      useTVPlayerStore.getState().setSleep(1);
      volumeOf(engine).mockClear();

      jest.advanceTimersByTime(29 * 1000);
      expect(volumeOf(engine)).not.toHaveBeenCalled();

      jest.advanceTimersByTime(16 * 1000);
      const mid = lastVolume(engine);
      expect(mid).toBeGreaterThan(0.4);
      expect(mid).toBeLessThan(0.6);
      expect(engine.pause).not.toHaveBeenCalled();

      jest.advanceTimersByTime(16 * 1000);
      expect(engine.pause).toHaveBeenCalled();
      expect(lastVolume(engine)).toBe(1);
      expect(useTVPlayerStore.getState().sleep).toEqual({kind: 'off'});
    } finally {
      jest.useRealTimers();
    }
  });

  it('restores full volume when the sleep timer is turned off mid-fade', () => {
    jest.useFakeTimers();
    try {
      const engine = makeMockEngine();
      useTVPlayerStore.getState().setEngine(engine);
      useTVPlayerStore.getState().setSleep(1);
      jest.advanceTimersByTime(50 * 1000);
      useTVPlayerStore.getState().setSleep(0);
      expect(lastVolume(engine)).toBe(1);
      jest.advanceTimersByTime(20 * 1000);
      expect(engine.pause).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('listening-room playback states', () => {
  beforeEach(() => {
    useTVPlayerStore.getState().reset();
  });

  it("a verse repeat's gap resumes on its own", async () => {
    jest.useFakeTimers();
    try {
      const engine = makeMockEngine();
      useTVPlayerStore.getState().setEngine(engine);
      await useTVPlayerStore.getState().loadQueue(queue, 0);
      (engine.play as jest.Mock).mockClear();
      useTVPlayerStore.getState().hold(2000);
      expect(engine.pause).toHaveBeenCalled();
      expect(useTVPlayerStore.getState().held).toBe(true);
      jest.advanceTimersByTime(2000);
      expect(engine.play).toHaveBeenCalledTimes(1);
      expect(useTVPlayerStore.getState().held).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('Play/Pause in the gap stays paused and cancels the replay', async () => {
    jest.useFakeTimers();
    try {
      const engine = makeMockEngine();
      useTVPlayerStore.getState().setEngine(engine);
      await useTVPlayerStore.getState().loadQueue(queue, 0);
      useTVPlayerStore.getState().hold(5000);
      engine.emit({status: 'paused', positionSeconds: 3, durationSeconds: 60});
      (engine.play as jest.Mock).mockClear();
      useTVPlayerStore.getState().toggle();
      expect(useTVPlayerStore.getState().held).toBe(false);
      jest.advanceTimersByTime(6000);
      expect(engine.play).not.toHaveBeenCalled();
      // The next press plays as usual.
      useTVPlayerStore.getState().toggle();
      expect(engine.play).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('a new track cancels a pending replay', async () => {
    jest.useFakeTimers();
    try {
      const engine = makeMockEngine();
      useTVPlayerStore.getState().setEngine(engine);
      await useTVPlayerStore.getState().loadQueue(queue, 0);
      useTVPlayerStore.getState().hold(2000);
      await useTVPlayerStore.getState().next();
      (engine.play as jest.Mock).mockClear();
      jest.advanceTimersByTime(3000);
      expect(engine.play).not.toHaveBeenCalled();
      expect(useTVPlayerStore.getState().held).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('a sleep timer that stops playback leaves the room slept until a press', () => {
    jest.useFakeTimers();
    try {
      const engine = makeMockEngine();
      useTVPlayerStore.getState().setEngine(engine);
      useTVPlayerStore.getState().setSleep(1);
      jest.advanceTimersByTime(61 * 1000);
      expect(useTVPlayerStore.getState().slept).toBe(true);
      useTVPlayerStore.getState().wake();
      expect(useTVPlayerStore.getState().slept).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('after "sleep at end of surah", play goes on to the next surah', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    useTVPlayerStore.getState().setSleep(-1);
    engine.emit({
      status: 'playing',
      positionSeconds: 59.8,
      durationSeconds: 60,
    });
    engine.emit({status: 'idle', positionSeconds: 60, durationSeconds: 60});
    expect(engine.pause).toHaveBeenCalled();
    expect(useTVPlayerStore.getState().slept).toBe(true);
    expect(useTVPlayerStore.getState().currentIndex).toBe(0);
    useTVPlayerStore.getState().toggle();
    await Promise.resolve();
    expect(useTVPlayerStore.getState().currentIndex).toBe(1);
    expect(engine.load).toHaveBeenLastCalledWith('https://x/002.mp3');
    expect(useTVPlayerStore.getState().slept).toBe(false);
  });
});

describe('seeking and stepping', () => {
  beforeEach(() => {
    useTVPlayerStore.getState().reset();
  });

  async function pausedAt(seconds: number) {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 1);
    engine.emit({
      status: 'paused',
      positionSeconds: seconds,
      durationSeconds: 60,
    });
    return engine;
  }

  it('moves the position at once while paused, so presses add up', async () => {
    const engine = await pausedAt(20);
    useTVPlayerStore.getState().seekBy(15);
    useTVPlayerStore.getState().seekBy(15);
    expect(useTVPlayerStore.getState().positionSeconds).toBe(50);
    expect(engine.seek).toHaveBeenLastCalledWith(50);
    useTVPlayerStore.getState().seekBy(30);
    expect(useTVPlayerStore.getState().positionSeconds).toBe(60);
    useTVPlayerStore.getState().seekTo(-4);
    expect(useTVPlayerStore.getState().positionSeconds).toBe(0);
  });

  it("holds a seek's target against a report from before it", async () => {
    const engine = await pausedAt(20);
    useTVPlayerStore.getState().seekTo(40);
    engine.emit({status: 'paused', positionSeconds: 20, durationSeconds: 60});
    expect(useTVPlayerStore.getState().positionSeconds).toBe(40);
    engine.emit({
      status: 'playing',
      positionSeconds: 40.4,
      durationSeconds: 60,
    });
    expect(useTVPlayerStore.getState().positionSeconds).toBe(40.4);
  });

  it('a second Previous while paused goes back a surah', async () => {
    const engine = await pausedAt(30);
    await useTVPlayerStore.getState().prev();
    expect(engine.seek).toHaveBeenLastCalledWith(0);
    expect(useTVPlayerStore.getState().currentIndex).toBe(1);
    await useTVPlayerStore.getState().prev();
    expect(useTVPlayerStore.getState().currentIndex).toBe(0);
  });

  it('Previous on the first surah restarts it rather than reload it', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    await useTVPlayerStore.getState().prev();
    expect(engine.load).toHaveBeenCalledTimes(1);
    expect(engine.seek).toHaveBeenLastCalledWith(0);
  });

  it('stepping back from the end of a finished queue plays from there', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 2);
    engine.emit({
      status: 'playing',
      positionSeconds: 59.8,
      durationSeconds: 60,
    });
    engine.emit({status: 'idle', positionSeconds: 60, durationSeconds: 60});
    expect(useTVPlayerStore.getState().finished).toBe(true);
    useTVPlayerStore.getState().seekTo(45);
    expect(useTVPlayerStore.getState().finished).toBe(false);
    (engine.seek as jest.Mock).mockClear();
    useTVPlayerStore.getState().toggle();
    expect(engine.seek).not.toHaveBeenCalled();
    expect(engine.play).toHaveBeenCalled();
  });
});

describe('shuffled queues', () => {
  beforeEach(() => {
    useTVPlayerStore.getState().reset();
  });

  it('play in their (already shuffled) order and end', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0, {shuffle: true});
    await useTVPlayerStore.getState().next();
    expect(useTVPlayerStore.getState().currentIndex).toBe(1);
    await useTVPlayerStore.getState().prev();
    expect(useTVPlayerStore.getState().currentIndex).toBe(0);
    await useTVPlayerStore.getState().jumpToIndex(2);
    engine.emit({
      status: 'playing',
      positionSeconds: 59.8,
      durationSeconds: 60,
    });
    engine.emit({status: 'idle', positionSeconds: 60, durationSeconds: 60});
    expect(useTVPlayerStore.getState().finished).toBe(true);
    expect(hasNextIn(useTVPlayerStore.getState())).toBe(false);
  });
});

describe('while a recitation is looked up', () => {
  beforeEach(() => {
    useTVPlayerStore.getState().reset();
  });

  it('transport presses leave the placeholder alone, so a failure still shows', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 1);
    const token = useTVPlayerStore
      .getState()
      .beginPending({...queue[0], audioUrl: ''}, jest.fn());
    (engine.load as jest.Mock).mockClear();
    (engine.seek as jest.Mock).mockClear();
    await useTVPlayerStore.getState().prev();
    await useTVPlayerStore.getState().next();
    useTVPlayerStore.getState().seekBy(15);
    useTVPlayerStore.getState().replay();
    await useTVPlayerStore.getState().jumpToIndex(0);
    expect(engine.load).not.toHaveBeenCalled();
    expect(engine.seek).not.toHaveBeenCalled();
    useTVPlayerStore.getState().failPending(token, 'Offline');
    expect(useTVPlayerStore.getState().status).toBe('error');
  });
});

describe('error messages', () => {
  it('keeps connection errors and hides native ones', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(describeError(new Error('The network connection was lost.'))).toBe(
      'The network connection was lost.',
    );
    expect(
      describeError(
        new Error('[ExpoAudioService] Player not set. Call setPlayer first.'),
      ),
    ).toBe(PLAYBACK_FAILED_MESSAGE);
    expect(describeError(undefined)).toBe(PLAYBACK_FAILED_MESSAGE);
    warn.mockRestore();
  });

  it("an engine error carries the engine's reason through", async () => {
    useTVPlayerStore.getState().reset();
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    engine.emit({
      status: 'error',
      positionSeconds: 0,
      durationSeconds: 0,
      error: 'The network connection timed out',
    });
    expect(useTVPlayerStore.getState().lastError).toBe(
      'The network connection timed out',
    );
  });
});

describe('the end-of-track hook', () => {
  afterEach(() => setEndOfTrackHook(null));

  it('plays the track again from where the hook says instead of moving on', async () => {
    useTVPlayerStore.getState().reset();
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    setEndOfTrackHook(() => ({seconds: 50, holdMs: 0}));
    engine.emit({
      status: 'playing',
      positionSeconds: 59.8,
      durationSeconds: 60,
    });
    engine.emit({status: 'idle', positionSeconds: 60, durationSeconds: 60});
    expect(engine.seek).toHaveBeenLastCalledWith(50);
    expect(useTVPlayerStore.getState().currentIndex).toBe(0);
    expect(useTVPlayerStore.getState().finished).toBe(false);
  });
});

// The progress writer's interval would keep Jest from exiting.
afterAll(() => useTVPlayerStore.getState().reset());
