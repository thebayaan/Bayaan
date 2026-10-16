import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isSavedSessionStale,
  toSavedSession,
  saveSession,
  loadSavedSession,
  restoreSavedSession,
  startSessionSaving,
  dropStaleSession,
} from '@/services/adhkar/playback/sessionPersistence';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {
  AdhkarSession,
  SavedSession,
} from '@/services/adhkar/playback/types';

function at(h: number, m = 0, day = 13): number {
  return new Date(2026, 9, day, h, m).getTime();
}

const items = [
  {dhikrId: 'a', audioFile: 'a.mp3', playable: true, preview: 'a'},
  {dhikrId: 'b', audioFile: 'b.mp3', playable: true, preview: 'b'},
];

const live: AdhkarSession = {
  listId: 'morning-adhkar',
  listTitle: 'Morning Adhkar',
  items,
  index: 1,
  mode: 'all',
  loop: false,
  status: 'playing',
  error: false,
  trackToken: 7,
  positionSec: 4.5,
  lastActiveAt: at(10),
};

function saved(over: Partial<SavedSession> = {}): SavedSession {
  return {
    listId: 'morning-adhkar',
    listTitle: 'Morning Adhkar',
    mode: 'all',
    loop: false,
    dhikrId: 'b',
    positionSec: 4.5,
    lastActiveAt: at(10),
    ...over,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useAdhkarSessionStore.setState({session: null, revealToken: 0});
});
afterEach(() => jest.restoreAllMocks());

it('saves only the listed fields', () => {
  expect(toSavedSession(live)).toEqual(saved());
});

describe('isSavedSessionStale', () => {
  it('Morning played at 10:00 lives until 15:00', () => {
    expect(isSavedSessionStale(saved(), at(14, 59))).toBe(false);
    expect(isSavedSessionStale(saved(), at(15))).toBe(true);
  });
  it('Evening played at 20:00 lives until 04:00', () => {
    const s = saved({listId: 'evening-adhkar', lastActiveAt: at(20)});
    expect(isSavedSessionStale(s, at(3, 59, 14))).toBe(false);
    expect(isSavedSessionStale(s, at(4, 0, 14))).toBe(true);
  });
  it('a session saved exactly at 15:00 lives until 04:00', () => {
    const s = saved({lastActiveAt: at(15)});
    expect(isSavedSessionStale(s, at(23))).toBe(false);
  });
  it('other lists live 24 hours', () => {
    const s = saved({listId: 'saved', lastActiveAt: at(10)});
    expect(isSavedSessionStale(s, at(9, 59, 14))).toBe(false);
    expect(isSavedSessionStale(s, at(10, 0, 14))).toBe(true);
  });
});

it('round-trips through AsyncStorage and clears on null', async () => {
  await saveSession(live);
  expect(await loadSavedSession()).toEqual(saved());
  await saveSession(null);
  expect(await loadSavedSession()).toBeNull();
});

it('restores as paused at the saved dhikr', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(at(11));
  await saveSession(live);
  await restoreSavedSession(async () => items);
  expect(useAdhkarSessionStore.getState().session).toMatchObject({
    index: 1,
    status: 'paused',
    positionSec: 4.5,
    mode: 'all',
  });
});

it('drops a saved session whose dhikr no longer exists', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(at(11));
  await saveSession(live);
  await restoreSavedSession(async () => [items[0]]);
  expect(useAdhkarSessionStore.getState().session).toBeNull();
  expect(await loadSavedSession()).toBeNull();
});

it('drops a stale saved session', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(at(16));
  await saveSession(live);
  await restoreSavedSession(async () => items);
  expect(useAdhkarSessionStore.getState().session).toBeNull();
});

describe('startSessionSaving', () => {
  let stopSaving: () => void;
  const flush = (): Promise<void> =>
    new Promise(resolve => setImmediate(resolve));

  beforeEach(() => {
    stopSaving = startSessionSaving();
  });
  afterEach(() => stopSaving());

  it('writes a new position from positionSaved', async () => {
    useAdhkarSessionStore.setState({session: live});
    useAdhkarSessionStore
      .getState()
      .dispatch({type: 'positionSaved', positionSec: 9});
    await flush();
    expect(await loadSavedSession()).toMatchObject({positionSec: 9});
  });

  it('writes on a status or track change', async () => {
    useAdhkarSessionStore.setState({session: live});
    useAdhkarSessionStore.setState({session: {...live, status: 'paused'}});
    await flush();
    expect(await loadSavedSession()).toMatchObject({dhikrId: 'b'});
    await AsyncStorage.clear();
    useAdhkarSessionStore.setState({
      session: {...live, status: 'paused', index: 0, trackToken: 8},
    });
    await flush();
    expect(await loadSavedSession()).toMatchObject({dhikrId: 'a'});
  });

  it('does not write when the session is unchanged', async () => {
    useAdhkarSessionStore.setState({session: live});
    await flush();
    await AsyncStorage.clear();
    useAdhkarSessionStore
      .getState()
      .dispatch({type: 'positionSaved', positionSec: 4.5});
    useAdhkarSessionStore.setState({session: {...live}});
    await flush();
    expect(await loadSavedSession()).toBeNull();
  });

  it('clears the saved copy on stop', async () => {
    await saveSession(live);
    useAdhkarSessionStore.setState({session: live});
    useAdhkarSessionStore.getState().dispatch({type: 'stop'});
    await flush();
    expect(await loadSavedSession()).toBeNull();
  });

  it('writes the current session when the app goes to the background', async () => {
    stopSaving();
    let handler: (
      state: 'active' | 'background' | 'inactive',
    ) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, h) => {
      handler = h;
      return {remove};
    });
    stopSaving = startSessionSaving();
    useAdhkarSessionStore.setState({session: live});
    await flush();
    await AsyncStorage.clear();
    handler('background');
    await flush();
    expect(await loadSavedSession()).toEqual(saved());
    stopSaving();
    expect(remove).toHaveBeenCalled();
  });
});

describe('dropStaleSession', () => {
  const paused: AdhkarSession = {...live, status: 'paused'};

  it('stops a paused stale session', () => {
    useAdhkarSessionStore.setState({session: paused});
    dropStaleSession(at(16));
    expect(useAdhkarSessionStore.getState().session).toBeNull();
  });
  it('leaves a playing session alone', () => {
    useAdhkarSessionStore.setState({session: live});
    dropStaleSession(at(16));
    expect(useAdhkarSessionStore.getState().session).toBe(live);
  });
  it('leaves a fresh paused session alone', () => {
    useAdhkarSessionStore.setState({session: paused});
    dropStaleSession(at(11));
    expect(useAdhkarSessionStore.getState().session).toBe(paused);
  });
});

describe('waitForSessionRestore', () => {
  type Persistence =
    typeof import('@/services/adhkar/playback/sessionPersistence');

  // The readiness promise is module state: each test gets a fresh module.
  function fresh(): Persistence {
    let mod: Persistence | null = null;
    jest.isolateModules(() => {
      mod = require('@/services/adhkar/playback/sessionPersistence');
    });
    if (!mod) throw new Error('module failed to load');
    return mod;
  }

  afterEach(() => jest.useRealTimers());

  it('resolves once the restore settles', async () => {
    const p = fresh();
    let settled = false;
    const waiting = p.waitForSessionRestore(60_000).then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await p.restoreSavedSession(async () => null);
    await waiting;
    expect(settled).toBe(true);
  });

  it('resolves at once after a restore that already settled', async () => {
    const p = fresh();
    await p.restoreSavedSession(async () => null);
    // Fake timers after the restore (AsyncStorage stays real), and none is
    // advanced: only the settled restore can resolve it.
    jest.useFakeTimers();
    await expect(p.waitForSessionRestore(60_000)).resolves.toBeUndefined();
  });

  it('settles even when the restore throws', async () => {
    const p = fresh();
    await p.saveSession({
      ...live,
      listId: 'saved',
      status: 'paused',
      lastActiveAt: Date.now(),
    });
    await expect(
      p.restoreSavedSession(async () => {
        throw new Error('db');
      }),
    ).rejects.toThrow('db');
    await expect(p.waitForSessionRestore(60_000)).resolves.toBeUndefined();
  });

  it('resolves after the timeout when no restore runs', async () => {
    jest.useFakeTimers();
    const p = fresh();
    let settled = false;
    const waiting = p.waitForSessionRestore(3000).then(() => {
      settled = true;
    });
    jest.advanceTimersByTime(2999);
    await Promise.resolve();
    expect(settled).toBe(false);
    jest.advanceTimersByTime(1);
    await waiting;
    expect(settled).toBe(true);
  });
});
