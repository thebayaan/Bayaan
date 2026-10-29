import type {AudioEngine, EngineEvent} from '../services/audioEngineTypes';
import {
  ADVANCE_DELAY_MS,
  NEXT_GAP_MS,
  REPLAY_GAP_MS,
  createAdhkarSessionStore,
} from './adhkarSessionController';

function fakeEngine() {
  let listener: ((e: EngineEvent) => void) | null = null;
  const engine: jest.Mocked<AudioEngine> = {
    load: jest.fn(async (_url: string) => {}),
    play: jest.fn(async () => {}),
    pause: jest.fn(),
    seek: jest.fn(),
    setRate: jest.fn(),
    setVolume: jest.fn(),
    subscribe: jest.fn(cb => {
      listener = cb;
      return () => {
        listener = null;
      };
    }),
    destroy: jest.fn(),
  };
  const emit = (e: EngineEvent): void => listener?.(e);
  return {engine, emit};
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function setup(autoAdvance: boolean | null = true) {
  const {engine, emit} = fakeEngine();
  const store = createAdhkarSessionStore({
    createEngine: () => engine,
    loadAutoAdvance: () => autoAdvance,
    dayKey: () => 'today',
  });
  return {store, engine, emit};
}

/** A clip of `duration` seconds playing through to its end. */
function playThrough(emit: (e: EngineEvent) => void, duration = 4): void {
  emit({status: 'playing', positionSeconds: 1, durationSeconds: duration});
  emit({
    status: 'playing',
    positionSeconds: duration,
    durationSeconds: duration,
  });
}

describe('adhkar session controller', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('opens a list and plays its first recitation', async () => {
    const {store, engine} = setup();
    store.getState().open('l', [1, 1], ['a.mp3', 'b.mp3']);
    await flush();
    expect(engine.load).toHaveBeenCalledWith('a.mp3');
    expect(store.getState().audio).toBe('playing');
  });

  it('OK counts, and reaching the count moves on after a beat', async () => {
    const {store, engine} = setup();
    store.getState().open('l', [2, 1], ['a.mp3', 'b.mp3']);
    await flush();
    store.getState().press();
    expect(store.getState().session?.counts[0]).toBe(1);
    store.getState().press();
    expect(store.getState().session?.index).toBe(0);
    jest.advanceTimersByTime(ADVANCE_DELAY_MS);
    await flush();
    expect(store.getState().session?.index).toBe(1);
    expect(engine.load).toHaveBeenLastCalledWith('b.mp3');
  });

  it('auto-advance repeats a dhikr until its count, then moves on', async () => {
    const {store, engine, emit} = setup(true);
    store.getState().open('l', [2, 1], ['a.mp3', 'b.mp3']);
    await flush();
    playThrough(emit);
    expect(store.getState().session?.counts[0]).toBe(1);
    expect(engine.seek).toHaveBeenCalledWith(0);
    jest.advanceTimersByTime(REPLAY_GAP_MS);
    await flush();
    expect(engine.play).toHaveBeenCalledTimes(2);
    playThrough(emit);
    expect(store.getState().session?.counts[0]).toBe(2);
    jest.advanceTimersByTime(NEXT_GAP_MS);
    await flush();
    expect(store.getState().session?.index).toBe(1);
    playThrough(emit);
    jest.advanceTimersByTime(NEXT_GAP_MS);
    await flush();
    expect(store.getState().session?.finished).toBe(true);
    expect(store.getState().audio).toBe('ended');
  });

  it('without auto-advance the recitation stops at its end', async () => {
    const {store, emit} = setup(false);
    store.getState().open('l', [3], ['a.mp3']);
    await flush();
    playThrough(emit);
    expect(store.getState().audio).toBe('ended');
    expect(store.getState().session?.counts[0]).toBe(0);
  });

  it('ignores a stale end position before the clip has started', async () => {
    const {store, emit} = setup(true);
    store.getState().open('l', [3], ['a.mp3']);
    await flush();
    emit({status: 'playing', positionSeconds: 4, durationSeconds: 4});
    expect(store.getState().session?.counts[0]).toBe(0);
  });

  it('pause and resume keep the loaded recitation', async () => {
    const {store, engine} = setup();
    store.getState().open('l', [1], ['a.mp3']);
    await flush();
    store.getState().togglePlay();
    expect(engine.pause).toHaveBeenCalled();
    expect(store.getState().audio).toBe('paused');
    store.getState().togglePlay();
    await flush();
    expect(engine.load).toHaveBeenCalledTimes(1);
    expect(store.getState().audio).toBe('playing');
  });

  it('moving while paused stays quiet', async () => {
    const {store, engine} = setup();
    store.getState().open('l', [1, 1], ['a.mp3', 'b.mp3']);
    await flush();
    store.getState().togglePlay();
    store.getState().next();
    await flush();
    expect(engine.load).toHaveBeenCalledTimes(1);
    expect(store.getState().session?.index).toBe(1);
  });

  it('stands down when another engine takes the player', async () => {
    const {store, emit} = setup();
    store.getState().open('l', [1], ['a.mp3']);
    await flush();
    emit({status: 'playing', positionSeconds: 1, durationSeconds: 10});
    emit({status: 'paused', positionSeconds: 1, durationSeconds: 10});
    expect(store.getState().audio).toBe('paused');
    expect(store.getState().wantsAudio).toBe(false);
  });

  it('a load failure shows as an error and counting still works', async () => {
    const {store, engine} = setup();
    engine.load.mockRejectedValueOnce(new Error('offline'));
    store.getState().open('l', [2], ['a.mp3']);
    await flush();
    expect(store.getState().audio).toBe('error');
    store.getState().press();
    expect(store.getState().session?.counts[0]).toBe(1);
  });

  it('resumes a list left part way the same day', async () => {
    const {store} = setup();
    store.getState().open('l', [1, 1, 1], ['a', 'b', 'c'], {autoplay: false});
    store.getState().next();
    store.getState().close();
    store.getState().open('l', [1, 1, 1], ['a', 'b', 'c'], {autoplay: false});
    expect(store.getState().session?.index).toBe(1);
  });

  it('close stops and releases the engine', async () => {
    const {store, engine} = setup();
    store.getState().open('l', [1], ['a.mp3']);
    await flush();
    store.getState().close();
    expect(engine.pause).toHaveBeenCalled();
    expect(engine.destroy).toHaveBeenCalled();
    expect(store.getState().session).toBeNull();
  });
});
