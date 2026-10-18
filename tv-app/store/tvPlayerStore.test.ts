import {useTVPlayerStore} from './tvPlayerStore';
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

  it('resolves and persists a non-null default reciter with no history', async () => {
    expect(storage.getString(DEFAULT_RECITER_KEY)).toBeUndefined();
    const id = await seedDefaultReciter();
    expect(id).not.toBeNull();
    expect(storage.getString(DEFAULT_RECITER_KEY)).toBe(id);
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
