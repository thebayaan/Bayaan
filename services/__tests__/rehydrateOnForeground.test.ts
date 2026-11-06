// @ai-generated
// A store whose hydrating read failed must read its key again when the app
// comes back to the foreground, so it can hydrate and save again. And the list
// in services/persistedStores must name every persisted store. It is read as
// text: importing every store would load their native modules.

import fs from 'fs';
import path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState, type AppStateStatus} from 'react-native';
import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {persistStorage} from '@/utils/storage';
import {
  initForegroundRehydration,
  rehydrateUnhydratedStores,
  teardownForegroundRehydration,
  type PersistedStore,
} from '../rehydrateOnForeground';

function fakeStore(hydrated: boolean, rehydrate = jest.fn()): PersistedStore {
  return {persist: {hasHydrated: () => hydrated, rehydrate}};
}

/**
 * Captures the AppState listener that initForegroundRehydration adds. The
 * jest-expo AppState is already a mock, so its calls are cleared here.
 */
function captureAppStateListener() {
  let listener: ((state: AppStateStatus) => void) | undefined;
  const addEventListener = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, handler) => {
      listener = handler;
      return {remove: jest.fn()} as unknown as ReturnType<
        typeof AppState.addEventListener
      >;
    });
  addEventListener.mockClear();
  const emit = (state: AppStateStatus): void => {
    if (!listener) throw new Error('no AppState listener');
    listener(state);
  };
  return {addEventListener, emit};
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setImmediate(resolve));
  }
}

afterEach(() => {
  teardownForegroundRehydration();
  jest.restoreAllMocks();
});

describe('rehydrateUnhydratedStores', () => {
  it('reads again only the stores that have not hydrated', () => {
    const hydrated = fakeStore(true);
    const failed = fakeStore(false);

    rehydrateUnhydratedStores([hydrated, failed]);

    expect(hydrated.persist.rehydrate).not.toHaveBeenCalled();
    expect(failed.persist.rehydrate).toHaveBeenCalledTimes(1);
  });

  it('does not start a second read while one is in flight', async () => {
    let finish!: () => void;
    const rehydrate = jest.fn(
      () => new Promise<void>(resolve => (finish = resolve)),
    );
    const store = fakeStore(false, rehydrate);

    rehydrateUnhydratedStores([store]);
    rehydrateUnhydratedStores([store]);
    expect(rehydrate).toHaveBeenCalledTimes(1);

    finish();
    await settle();
    rehydrateUnhydratedStores([store]);
    expect(rehydrate).toHaveBeenCalledTimes(2);
  });
});

describe('initForegroundRehydration', () => {
  it('reads again when the app comes to the foreground', () => {
    const {emit} = captureAppStateListener();
    const store = fakeStore(false);
    initForegroundRehydration([store]);

    emit('background');
    emit('inactive');
    expect(store.persist.rehydrate).not.toHaveBeenCalled();

    emit('active');
    expect(store.persist.rehydrate).toHaveBeenCalledTimes(1);
  });

  it('adds one listener however often it is called', () => {
    const {addEventListener} = captureAppStateListener();

    initForegroundRehydration([]);
    initForegroundRehydration([]);

    expect(addEventListener).toHaveBeenCalledTimes(1);
  });

  it('lets a store whose read failed hydrate and save again', async () => {
    const key = 'foreground-retry-store';
    const saved = {state: {count: 1}, version: 0};
    await AsyncStorage.setItem(key, JSON.stringify(saved));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    // The store's first read is its hydration.
    jest
      .mocked(AsyncStorage.getItem)
      .mockRejectedValueOnce(new Error('NSCocoaErrorDomain Code=257'));
    const {emit} = captureAppStateListener();

    const useCounter = create<{count: number}>()(
      persist(() => ({count: 0}), {name: key, storage: persistStorage()}),
    );
    await settle();
    expect(useCounter.persist.hasHydrated()).toBe(false);

    useCounter.setState({count: 5});
    await settle();
    expect(await AsyncStorage.getItem(key)).toBe(JSON.stringify(saved));

    initForegroundRehydration([useCounter]);
    emit('active');
    await settle();

    expect(useCounter.persist.hasHydrated()).toBe(true);
    expect(useCounter.getState().count).toBe(1);

    useCounter.setState({count: 2});
    await settle();
    expect(JSON.parse((await AsyncStorage.getItem(key)) as string)).toEqual({
      state: {count: 2},
      version: 0,
    });
  });
});

describe('PERSISTED_STORES', () => {
  const root = path.resolve(__dirname, '../..');
  const skipped = new Set(['node_modules', 'ios', 'android', 'assets']);
  // Persisted, but not retried: a late merge into the player store would
  // replace the queue that plays.
  const notRetried = new Set(['services/player/store/playerStore.ts']);

  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return entry.name.startsWith('.') ||
          entry.name === '__tests__' ||
          skipped.has(entry.name)
          ? []
          : sourceFiles(full);
      }
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
        ? [full]
        : [];
    });
  }

  /** Each module that creates a persisted store, relative to the repo root. */
  function persistedModules(): string[] {
    return sourceFiles(root)
      .filter(file => {
        const text = fs.readFileSync(file, 'utf8');
        return (
          /\bpersist\(/.test(text) && text.includes("from 'zustand/middleware'")
        );
      })
      .map(file => path.relative(root, file).split(path.sep).join('/'));
  }

  it('imports every module that creates a persisted store', () => {
    const list = fs.readFileSync(
      path.join(__dirname, '../persistedStores.ts'),
      'utf8',
    );
    const persisted = persistedModules();

    expect(persisted.length).toBeGreaterThan(10);
    const missing = persisted.filter(
      file =>
        !notRetried.has(file) &&
        !list.includes(`from '@/${file.replace(/\.tsx?$/, '')}'`),
    );
    expect(missing).toEqual([]);
  });

  it('gives every persisted store the guarded storage', () => {
    const unguarded = persistedModules().filter(
      file =>
        !/storage: persistStorage(<[^>]*>)?\(\)/.test(
          fs.readFileSync(path.join(root, file), 'utf8'),
        ),
    );
    expect(unguarded).toEqual([]);
  });

  it('leaves the player store out', () => {
    const list = fs.readFileSync(
      path.join(__dirname, '../persistedStores.ts'),
      'utf8',
    );
    expect(list).not.toContain("from '@/services/player/store/playerStore'");
  });
});
