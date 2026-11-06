import type {
  ActivityStartResult,
  AdhkarSessionActivityState,
} from 'bayaan-widgets';
import type {SessionSource} from '@/services/adhkar/playback/types';
import {
  ADHKAR_PAUSED_END_MS,
  ADHKAR_PLAYING_STALE_MS,
} from '../planAdhkarActivity';
import {ADHKAR_STALE_REFRESH_MARGIN_MS} from '../syncAdhkarActivity';

const mockLog: string[] = [];
const mockStart = jest.fn<
  Promise<ActivityStartResult>,
  [AdhkarSessionActivityState, number]
>();
const mockUpdate = jest.fn<
  Promise<boolean>,
  [AdhkarSessionActivityState, number]
>();
const mockEnd = jest.fn<Promise<void>, [number | undefined]>();
let mockSupported = true;
let mockPlatformOS = 'ios';
let mockEnabled = true;
let mockActiveSource = 'adhkar';
let mockCoordinatorListener: (() => void) | null = null;
let mockAppStateListener: ((state: string) => void) | null = null;

function mockDescribe(s: AdhkarSessionActivityState): string {
  return `${s.position}/${s.total}:${s.isPlaying ? 'playing' : 'paused'}`;
}

jest.mock('bayaan-widgets', () => ({
  ...jest.requireActual('bayaan-widgets'),
  isLiveActivitySupported: () => mockSupported,
  startAdhkarSessionActivity: (s: AdhkarSessionActivityState, at: number) => {
    mockLog.push(`start:${mockDescribe(s)}`);
    return mockStart(s, at);
  },
  updateAdhkarSessionActivity: (s: AdhkarSessionActivityState, at: number) => {
    mockLog.push(`update:${mockDescribe(s)}`);
    return mockUpdate(s, at);
  },
  endAdhkarSessionActivities: (dismissAt?: number) => {
    mockLog.push(dismissAt === undefined ? 'end' : `end@${dismissAt}`);
    return mockEnd(dismissAt);
  },
}));
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const appState = {
    addEventListener: (_event: string, cb: (state: string) => void) => {
      mockAppStateListener = cb;
      return {remove: jest.fn()};
    },
  };
  const platform = {
    get OS(): string {
      return mockPlatformOS;
    },
  };
  return new Proxy(actual, {
    get: (target, prop) => {
      if (prop === 'AppState') return appState;
      if (prop === 'Platform') return platform;
      return target[prop];
    },
  });
});
jest.mock('../config', () => ({adhkarLiveActivityEnabled: () => mockEnabled}));
jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {
    getActiveSource: () => mockActiveSource,
    subscribe: (listener: () => void) => {
      mockCoordinatorListener = listener;
      return () => {
        mockCoordinatorListener = null;
      };
    },
  },
}));

type SyncModule = typeof import('../syncAdhkarActivity');
type Store = typeof import('@/store/adhkarSessionStore').useAdhkarSessionStore;

// Stops every sync a test started, so no timer outlives the test.
const mockCleanups: Array<() => void> = [];

// The sync and the store must share one module registry.
function load(): {sync: SyncModule; store: Store} {
  let loaded: {sync: SyncModule; store: Store} | null = null;
  jest.isolateModules(() => {
    const sync: SyncModule = require('../syncAdhkarActivity');
    loaded = {
      sync: {
        ...sync,
        startAdhkarActivitySync: () => {
          const stop = sync.startAdhkarActivitySync();
          mockCleanups.push(stop);
          return stop;
        },
      },
      store: require('@/store/adhkarSessionStore').useAdhkarSessionStore,
    };
  });
  if (!loaded) throw new Error('modules failed to load');
  return loaded;
}

const morning: SessionSource = {
  listId: 'morning-adhkar',
  listTitle: 'Morning Adhkar',
  items: ['a', 'b', 'c'].map(id => ({
    dhikrId: id,
    audioFile: `${id}.mp3`,
    playable: true,
    preview: id,
  })),
};

function confirmPlaying(store: Store): void {
  const session = store.getState().session;
  if (!session) throw new Error('expected a session');
  store.getState().dispatch({type: 'playStarted', token: session.trackToken});
}

function playAll(store: Store): void {
  store.getState().dispatch({type: 'pressPlayAll', source: morning});
  confirmPlaying(store);
}

function nextTrack(store: Store): void {
  const session = store.getState().session;
  if (!session) throw new Error('expected a session');
  store.getState().dispatch({type: 'trackEnded', token: session.trackToken});
}

describe('syncAdhkarActivity', () => {
  beforeEach(() => {
    mockLog.length = 0;
    mockStart.mockReset().mockResolvedValue('started');
    mockUpdate.mockReset().mockResolvedValue(true);
    mockEnd.mockReset().mockResolvedValue(undefined);
    mockSupported = true;
    mockPlatformOS = 'ios';
    mockEnabled = true;
    mockActiveSource = 'adhkar';
    mockCoordinatorListener = null;
    mockAppStateListener = null;
  });

  afterEach(() => {
    mockCleanups.splice(0).forEach(stop => stop());
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does nothing off iOS, when unsupported, or when disabled', async () => {
    for (const setup of [
      () => (mockPlatformOS = 'android'),
      () => (mockSupported = false),
      () => (mockEnabled = false),
    ]) {
      setup();
      const {sync, store} = load();
      sync.startAdhkarActivitySync();
      playAll(store);
      await sync.reconcileAdhkarActivity();
      mockPlatformOS = 'ios';
      mockSupported = true;
      mockEnabled = true;
    }
    expect(mockLog).toEqual([]);
    expect(mockCoordinatorListener).toBeNull();
  });

  it('ends a surviving activity at start, then starts on the first play', async () => {
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['end']);
    store.getState().dispatch({type: 'pressPlayAll', source: morning});
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['end']); // loading does not start it
    confirmPlaying(store);
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['end', 'start:1/3:playing']);
  });

  it('updates on the next track and on pause, and ends on stop', async () => {
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    nextTrack(store);
    await sync.reconcileAdhkarActivity();
    confirmPlaying(store);
    await sync.reconcileAdhkarActivity();
    store.getState().dispatch({type: 'toggle'});
    await sync.reconcileAdhkarActivity();
    store.getState().dispatch({type: 'stop'});
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual([
      'end',
      'start:1/3:playing',
      'update:2/3:playing',
      'update:2/3:paused',
      'end',
    ]);
  });

  it('ends when Quran takes over a playing session', async () => {
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    // AudioCoordinator.mainWillPlay: the dispatch runs before the source is
    // set to main; the chained reconcile reads it after.
    mockActiveSource = 'none';
    store.getState().dispatch({type: 'otherAudioStarted'});
    mockActiveSource = 'main';
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['end', 'start:1/3:playing', 'end']);
  });

  it('ends when Quran starts after the user paused adhkar', async () => {
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    store.getState().dispatch({type: 'toggle'});
    await sync.reconcileAdhkarActivity();
    mockLog.length = 0;
    mockActiveSource = 'main';
    mockCoordinatorListener?.();
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['end']);
  });

  it('ends 15 minutes after a pause', async () => {
    jest.useFakeTimers({
      now: 1_000_000,
      doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
    });
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    store.getState().dispatch({type: 'toggle'});
    await sync.reconcileAdhkarActivity();
    mockLog.length = 0;
    jest.advanceTimersByTime(ADHKAR_PAUSED_END_MS - 1);
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual([]);
    jest.advanceTimersByTime(1);
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['end']);
  });

  it('ends a paused activity for the background, dismissed at the pause limit', async () => {
    jest.useFakeTimers({
      now: 1_000_000,
      doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
    });
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    jest.advanceTimersByTime(30_000);
    store.getState().dispatch({type: 'toggle'});
    await sync.reconcileAdhkarActivity();
    const pausedAt = store.getState().session?.lastActiveAt;
    expect(pausedAt).toBe(1_030_000);
    jest.advanceTimersByTime(60_000);
    mockLog.length = 0;
    mockAppStateListener?.('background');
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual([`end@${1_030_000 + ADHKAR_PAUSED_END_MS}`]);
    // Memory forgot it, so no timer is left to end it again.
    expect(jest.getTimerCount()).toBe(0);
  });

  it('leaves a playing activity alone when the app goes to the background', async () => {
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    mockLog.length = 0;
    mockAppStateListener?.('background');
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual([]);
  });

  it('starts a fresh activity on play after a background end', async () => {
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    store.getState().dispatch({type: 'toggle'});
    await sync.reconcileAdhkarActivity();
    mockAppStateListener?.('background');
    await sync.reconcileAdhkarActivity();
    mockLog.length = 0;
    mockAppStateListener?.('active');
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual([]); // still paused: nothing to show
    store.getState().dispatch({type: 'toggle'});
    confirmPlaying(store);
    await sync.reconcileAdhkarActivity();
    // The delayed-dismissal activity is cleared before the new one starts.
    expect(mockLog).toEqual(['end', 'start:1/3:playing']);
  });

  it('stamps the refresh clock when a start finds an activity to update', async () => {
    jest.useFakeTimers({
      now: 1_000_000,
      doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
    });
    mockStart.mockResolvedValueOnce('updated');
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    jest.advanceTimersByTime(60_000);
    playAll(store);
    await sync.reconcileAdhkarActivity();
    // The stale date was just pushed: no refresh right away.
    expect(mockLog).toEqual(['end', 'start:1/3:playing']);
    mockLog.length = 0;
    const refreshIn = ADHKAR_PLAYING_STALE_MS - ADHKAR_STALE_REFRESH_MARGIN_MS;
    jest.advanceTimersByTime(refreshIn - 1);
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual([]);
    jest.advanceTimersByTime(1);
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['update:1/3:playing']);
  });

  it('refreshes the stale date of an unchanged playing activity', async () => {
    jest.useFakeTimers({
      now: 1_000_000,
      doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
    });
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    mockLog.length = 0;
    // A single dhikr on loop never changes the shown state.
    const refreshIn = ADHKAR_PLAYING_STALE_MS - ADHKAR_STALE_REFRESH_MARGIN_MS;
    jest.advanceTimersByTime(refreshIn - 1);
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual([]);
    jest.advanceTimersByTime(1);
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['update:1/3:playing']);
    expect(mockUpdate).toHaveBeenLastCalledWith(
      expect.anything(),
      Date.now() + ADHKAR_PLAYING_STALE_MS,
    );
  });

  it('does not restart a dismissed activity until a new session', async () => {
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    mockUpdate.mockResolvedValueOnce(false); // the user swiped it away
    nextTrack(store);
    await sync.reconcileAdhkarActivity();
    confirmPlaying(store);
    nextTrack(store);
    confirmPlaying(store);
    await sync.reconcileAdhkarActivity();
    expect(mockStart).toHaveBeenCalledTimes(1);
    store.getState().dispatch({type: 'stop'});
    await sync.reconcileAdhkarActivity();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('retries a deferred start on foreground', async () => {
    mockStart.mockResolvedValueOnce('deferred');
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    mockAppStateListener?.('active');
    await sync.reconcileAdhkarActivity();
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('treats a rejecting native start as a failed start', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockStart.mockRejectedValue(new Error('native boom'));
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    nextTrack(store);
    confirmPlaying(store);
    await sync.reconcileAdhkarActivity();
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('stops reacting after cleanup', async () => {
    const {sync, store} = load();
    const stop = sync.startAdhkarActivitySync();
    await sync.reconcileAdhkarActivity();
    stop();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    expect(mockLog).toEqual(['end']);
    expect(mockCoordinatorListener).toBeNull();
  });

  it('leaves no timers and makes no later call after cleanup', async () => {
    jest.useFakeTimers({
      now: 1_000_000,
      doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
    });
    for (const pause of [false, true]) {
      const {sync, store} = load();
      const stop = sync.startAdhkarActivitySync();
      playAll(store);
      await sync.reconcileAdhkarActivity();
      if (pause) {
        store.getState().dispatch({type: 'toggle'});
        await sync.reconcileAdhkarActivity();
      }
      expect(jest.getTimerCount()).toBe(1);
      stop();
      expect(jest.getTimerCount()).toBe(0);
      mockLog.length = 0;
      jest.advanceTimersByTime(ADHKAR_PAUSED_END_MS * 2);
      await Promise.resolve();
      expect(mockLog).toEqual([]);
    }
  });

  it('still resets memory and schedules when the native end rejects', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const {sync, store} = load();
    sync.startAdhkarActivitySync();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    mockEnd.mockRejectedValueOnce(new Error('native boom'));
    store.getState().dispatch({type: 'stop'});
    await sync.reconcileAdhkarActivity();
    playAll(store);
    await sync.reconcileAdhkarActivity();
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('drops the result of a start that a restart overtook', async () => {
    let finishStart: (r: 'started') => void = () => undefined;
    mockStart.mockReset().mockImplementationOnce(
      () =>
        new Promise<'started'>(resolve => {
          finishStart = resolve;
        }),
    );
    mockStart.mockResolvedValue('started');
    const {sync, store} = load();
    const stop = sync.startAdhkarActivitySync();
    playAll(store);
    const pending = sync.reconcileAdhkarActivity();
    while (mockStart.mock.calls.length === 0) await Promise.resolve();
    stop();
    sync.startAdhkarActivitySync();
    finishStart('started');
    await pending;
    await sync.reconcileAdhkarActivity();
    // The restart ended the stale activity and memory forgot it, so the
    // session starts again instead of being treated as live.
    expect(mockStart).toHaveBeenCalledTimes(2);
  });
});
