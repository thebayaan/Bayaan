import type {AudioEngine, EngineEvent} from '../services/audioEngineTypes';
import {
  ADVANCE_DELAY_MS,
  MAX_AUDIO_FAILURES,
  NEXT_GAP_MS,
  REPLAY_GAP_MS,
  advanceModeOf,
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
  const saveAutoAdvance = jest.fn();
  const store = createAdhkarSessionStore({
    createEngine: () => engine,
    loadAutoAdvance: () => autoAdvance,
    saveAutoAdvance,
    dayKey: () => 'today',
  });
  return {store, engine, emit, saveAutoAdvance};
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

  it('auto-advance is off until the viewer turns it on', () => {
    const {store} = setup(null);
    expect(store.getState().autoAdvance).toBe(false);
    expect(advanceModeOf(store.getState())).toBe('off');
  });

  it('reading opens quietly', async () => {
    const {store, engine} = setup();
    store.getState().open('l', [1], ['a.mp3'], {autoplay: false});
    await flush();
    expect(engine.load).not.toHaveBeenCalled();
    expect(store.getState().audio).toBe('idle');
  });

  it('listening through plays each dhikr once and moves on', async () => {
    const {store, engine, emit} = setup(false);
    store.getState().open('l', [3, 1], ['a.mp3', 'b.mp3'], {advance: 'once'});
    await flush();
    playThrough(emit);
    expect(store.getState().session?.counts[0]).toBe(1);
    expect(engine.seek).not.toHaveBeenCalled();
    jest.advanceTimersByTime(NEXT_GAP_MS);
    await flush();
    expect(store.getState().session?.index).toBe(1);
    expect(engine.load).toHaveBeenLastCalledWith('b.mp3');
  });

  it("a start mode's advance is for the visit only", async () => {
    const {store, saveAutoAdvance} = setup(false);
    store.getState().open('l', [2], ['a.mp3'], {advance: 'count'});
    expect(advanceModeOf(store.getState())).toBe('count');
    store.getState().setAutoAdvance(false);
    expect(advanceModeOf(store.getState())).toBe('off');
    store.getState().setAutoAdvance(true);
    expect(advanceModeOf(store.getState())).toBe('count');
    expect(saveAutoAdvance).not.toHaveBeenCalled();
    store.getState().close();
    expect(store.getState().sessionAdvance).toBeNull();
    expect(store.getState().autoAdvance).toBe(false);
    // Without a start mode the chip is the viewer's saved choice.
    store.getState().open('l', [2], ['a.mp3'], {autoplay: false});
    store.getState().setAutoAdvance(true);
    expect(saveAutoAdvance).toHaveBeenCalledWith(true);
  });

  it("OK during a counting recitation is that recitation's count", async () => {
    const {store, emit} = setup(true);
    store.getState().open('l', [3], ['a.mp3']);
    await flush();
    emit({status: 'playing', positionSeconds: 1, durationSeconds: 4});
    store.getState().press();
    emit({status: 'playing', positionSeconds: 4, durationSeconds: 4});
    expect(store.getState().session?.counts[0]).toBe(1);
  });

  it('says when a list resumed, until it starts over', () => {
    const {store} = setup();
    store.getState().open('l', [1, 1, 1], ['a', 'b', 'c'], {autoplay: false});
    expect(store.getState().resumed).toBe(false);
    store.getState().next();
    store.getState().close();
    store.getState().open('l', [1, 1, 1], ['a', 'b', 'c'], {autoplay: false});
    expect(store.getState().resumed).toBe(true);
    store.getState().restart();
    expect(store.getState().resumed).toBe(false);
    expect(store.getState().session?.index).toBe(0);
  });

  it('keeps the page: a new dhikr opens on its first, a resumed list where it was', () => {
    const {store} = setup();
    store.getState().open('l', [1, 1], ['a', 'b'], {autoplay: false});
    store.getState().setPage(2);
    store.getState().close();
    store.getState().open('l', [1, 1], ['a', 'b'], {autoplay: false});
    expect(store.getState().page).toBe(2);
    store.getState().next();
    expect(store.getState().page).toBe(0);
  });

  it('back from the player: as it was, waiting for Play', async () => {
    const {store, engine} = setup(false);
    store.getState().open('l', [3, 1], ['a.mp3', 'b.mp3'], {advance: 'once'});
    await flush();
    expect(engine.load).toHaveBeenCalledTimes(1);
    store.getState().setPage(1);
    store.getState().close({covered: true});
    store.getState().open('l', [3, 1], ['a.mp3', 'b.mp3'], {advance: 'once'});
    await flush();
    expect(engine.load).toHaveBeenCalledTimes(1);
    expect(store.getState().audio).toBe('idle');
    expect(store.getState().page).toBe(1);
    expect(store.getState().resumed).toBe(false);
    expect(advanceModeOf(store.getState())).toBe('once');
    // A fresh visit plays as its start mode says.
    store.getState().close();
    store.getState().open('l', [3, 1], ['a.mp3', 'b.mp3'], {advance: 'once'});
    await flush();
    expect(engine.load).toHaveBeenCalledTimes(2);
  });

  it('keeps lists left part way in storage, for today only', () => {
    const saveLeft = jest.fn();
    const {engine} = fakeEngine();
    const stale = {
      day: 'yesterday',
      page: 0,
      state: {
        listId: 'old',
        targets: [1],
        counts: [0],
        index: 0,
        finished: false,
      },
    };
    const kept = {
      day: 'today',
      page: 1,
      state: {
        listId: 'l',
        targets: [1, 1],
        counts: [1, 0],
        index: 1,
        finished: false,
      },
    };
    const store = createAdhkarSessionStore({
      createEngine: () => engine,
      dayKey: () => 'today',
      loadLeft: () => ({old: stale, l: kept, broken: {day: 'today'} as never}),
      saveLeft,
    });
    store.getState().open('l', [1, 1], ['a', 'b'], {autoplay: false});
    expect(store.getState().resumed).toBe(true);
    expect(store.getState().session?.index).toBe(1);
    expect(store.getState().page).toBe(1);
    store.getState().press();
    const saved = saveLeft.mock.calls[saveLeft.mock.calls.length - 1][0];
    expect(Object.keys(saved)).toEqual(['l']);
    expect(saved.l.state.counts).toEqual([1, 1]);
  });

  it('listening through moves on past a recitation that fails, with a word', async () => {
    const notify = jest.fn();
    const {engine} = fakeEngine();
    engine.load.mockRejectedValueOnce(new Error('offline'));
    const store = createAdhkarSessionStore({
      createEngine: () => engine,
      dayKey: () => 'today',
      notify,
    });
    store.getState().open('l', [1, 1], ['a.mp3', 'b.mp3'], {advance: 'once'});
    await flush();
    expect(store.getState().audio).toBe('error');
    expect(notify).toHaveBeenCalledWith(
      "Couldn't play this recitation, moving on",
    );
    jest.advanceTimersByTime(NEXT_GAP_MS);
    await flush();
    expect(store.getState().session?.index).toBe(1);
    expect(store.getState().audio).toBe('playing');
  });

  it('stops after several recitations fail in a row', async () => {
    const notify = jest.fn();
    const {engine} = fakeEngine();
    engine.load.mockRejectedValue(new Error('offline'));
    const store = createAdhkarSessionStore({
      createEngine: () => engine,
      dayKey: () => 'today',
      notify,
    });
    const targets = Array.from({length: MAX_AUDIO_FAILURES + 2}, () => 1);
    const urls = targets.map((_, i) => `${i}.mp3`);
    store.getState().open('l', targets, urls, {advance: 'once'});
    for (let i = 0; i < MAX_AUDIO_FAILURES + 1; i++) {
      await flush();
      jest.advanceTimersByTime(NEXT_GAP_MS);
    }
    await flush();
    expect(notify).toHaveBeenLastCalledWith('Recitations need a connection');
    expect(store.getState().session?.index).toBe(MAX_AUDIO_FAILURES - 1);
    expect(store.getState().wantsAudio).toBe(false);
  });

  it('reading on, a failed recitation just says Retry', async () => {
    const notify = jest.fn();
    const {engine} = fakeEngine();
    engine.load.mockRejectedValueOnce(new Error('offline'));
    const store = createAdhkarSessionStore({
      createEngine: () => engine,
      loadAutoAdvance: () => false,
      dayKey: () => 'today',
      notify,
    });
    store.getState().open('l', [1, 1], ['a.mp3', 'b.mp3']);
    await flush();
    jest.advanceTimersByTime(NEXT_GAP_MS);
    expect(store.getState().audio).toBe('error');
    expect(store.getState().session?.index).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('reports how far the recitation is', async () => {
    const {store, emit} = setup();
    store.getState().open('l', [1], ['a.mp3']);
    await flush();
    emit({status: 'playing', positionSeconds: 1, durationSeconds: 4});
    expect(store.getState().clipProgress).toBe(0.25);
  });
});
