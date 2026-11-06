// @ai-start
// Locks the contract of `safeAsyncStorage`: a failed write is logged and
// reported once, and never rejects, so zustand `persist` cannot turn a full
// disk into an unhandled rejection on every state change (BAYAAN-6J). And of
// `persistStorage`: a key is written only after a read of it resolved, and the
// first failed read is reported once.
// Sentry and AsyncStorage are the root __mocks__ stubs.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import {
  persistStorage,
  resetStorageForTests,
  safeAsyncStorage,
} from '../storage';

const outOfSpace = new Error(
  'Failed to write value. NSCocoaErrorDomain Code=640 out of space',
);

// The AsyncStorage stub's methods are jest.fn wrappers around an in-memory
// map, so a test overrides them with a rejection and afterEach puts the
// in-memory implementation back.
const realGetItem = jest.mocked(AsyncStorage.getItem).getMockImplementation();
const realSetItem = jest.mocked(AsyncStorage.setItem).getMockImplementation();
const realRemoveItem = jest
  .mocked(AsyncStorage.removeItem)
  .getMockImplementation();

afterEach(() => {
  jest.mocked(AsyncStorage.getItem).mockImplementation(realGetItem);
  jest.mocked(AsyncStorage.setItem).mockImplementation(realSetItem);
  jest.mocked(AsyncStorage.removeItem).mockImplementation(realRemoveItem);
  jest.restoreAllMocks();
});

describe('safeAsyncStorage', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.mocked(Sentry.captureMessage).mockClear();
    resetStorageForTests();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('writes and reads through to AsyncStorage', async () => {
    await safeAsyncStorage.setItem('k', 'v');

    expect(await safeAsyncStorage.getItem('k')).toBe('v');
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('resolves when setItem fails', async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValue(outOfSpace);

    await expect(safeAsyncStorage.setItem('k', 'v')).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('resolves when removeItem fails', async () => {
    jest.mocked(AsyncStorage.removeItem).mockRejectedValue(outOfSpace);

    await expect(safeAsyncStorage.removeItem('k')).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('reports only the first failed write to Sentry', async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValue(outOfSpace);

    await safeAsyncStorage.setItem('a', '1');
    await safeAsyncStorage.setItem('b', '2');
    await safeAsyncStorage.setItem('c', '3');

    expect(warnSpy).toHaveBeenCalledTimes(3);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'storage-write-failed',
      expect.objectContaining({
        level: 'warning',
        tags: {storage_op: 'setItem'},
      }),
    );
  });
});

describe('persistStorage', () => {
  beforeEach(() => {
    resetStorageForTests();
  });

  it('round-trips JSON state the way persist stores it', async () => {
    const store = persistStorage<{count: number}>();
    const value = {state: {count: 3}, version: 1};

    // persist reads a key before it writes it.
    expect(await store?.getItem('json')).toBeNull();
    await store?.setItem('json', value);

    expect(await store?.getItem('json')).toEqual(value);
    expect(await store?.getItem('missing')).toBeNull();
  });

  it('does not reject when the underlying write fails', async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValue(outOfSpace);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = persistStorage<{count: number}>();
    await store?.getItem('json');

    await expect(
      store?.setItem('json', {state: {count: 1}, version: 0}),
    ).resolves.toBeUndefined();
  });
});

// A failed hydrating read must never let a store's defaults overwrite the
// saved data, so persistStorage writes a key only after a read of it resolved.
describe('persistStorage before a key is read', () => {
  const saved = {state: {count: 1}, version: 0};
  const changed = {state: {count: 2}, version: 0};
  const locked = new Error('NSCocoaErrorDomain Code=257 permission denied');

  const onDisk = async (key: string): Promise<unknown> =>
    JSON.parse((await AsyncStorage.getItem(key)) as string);

  beforeEach(async () => {
    jest.mocked(Sentry.captureMessage).mockClear();
    resetStorageForTests();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await AsyncStorage.setItem('guarded', JSON.stringify(saved));
  });

  it('writes a key once its read has resolved', async () => {
    const store = persistStorage<{count: number}>();

    expect(await store?.getItem('guarded')).toEqual(saved);
    await store?.setItem('guarded', changed);

    expect(await onDisk('guarded')).toEqual(changed);
  });

  it('writes on a fresh install, where the read resolves with null', async () => {
    const store = persistStorage<{count: number}>();

    expect(await store?.getItem('fresh')).toBeNull();
    await store?.setItem('fresh', changed);

    expect(await onDisk('fresh')).toEqual(changed);
  });

  it('drops a write and a remove made before the read', async () => {
    const store = persistStorage<{count: number}>();

    await store?.setItem('guarded', changed);
    await store?.removeItem('guarded');

    expect(await onDisk('guarded')).toEqual(saved);
  });

  it('drops a write made while the read is in flight', async () => {
    const store = persistStorage<{count: number}>();

    const read = store?.getItem('guarded');
    await store?.setItem('guarded', changed);

    expect(await read).toEqual(saved);
    expect(await onDisk('guarded')).toEqual(saved);
  });

  it('keeps a key read-only after its read rejects', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValue(locked);
    const store = persistStorage<{count: number}>();

    await expect(store?.getItem('guarded')).rejects.toBe(locked);
    await store?.setItem('guarded', changed);
    await store?.removeItem('guarded');

    jest.mocked(AsyncStorage.getItem).mockImplementation(realGetItem);
    expect(await onDisk('guarded')).toEqual(saved);
  });

  it('reports only the first failed read to Sentry', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValue(locked);
    const store = persistStorage<{count: number}>();

    await expect(store?.getItem('guarded')).rejects.toBe(locked);
    await expect(store?.getItem('other')).rejects.toBe(locked);

    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'storage-read-failed',
      expect.objectContaining({
        level: 'warning',
        tags: {storage_op: 'getItem'},
        extra: {key: 'guarded', error: String(locked)},
      }),
    );
  });

  it('reports a failed write apart from a failed read', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(locked);
    jest.mocked(AsyncStorage.setItem).mockRejectedValue(outOfSpace);
    const store = persistStorage<{count: number}>();

    await expect(store?.getItem('guarded')).rejects.toBe(locked);
    await store?.getItem('guarded');
    await store?.setItem('guarded', changed);

    expect(
      jest.mocked(Sentry.captureMessage).mock.calls.map(c => c[0]),
    ).toEqual(['storage-read-failed', 'storage-write-failed']);
  });

  it('makes the key writable when a later read resolves', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(locked);
    const store = persistStorage<{count: number}>();

    await expect(store?.getItem('guarded')).rejects.toBe(locked);
    expect(await store?.getItem('guarded')).toEqual(saved);
    await store?.setItem('guarded', changed);

    expect(await onDisk('guarded')).toEqual(changed);
  });
});
// @ai-end

// @ai-start
describe('safeAsyncStorage reads of merged reciters', () => {
  it('hydrates saved data under the kept reciter id', async () => {
    await AsyncStorage.setItem(
      'loved',
      JSON.stringify({
        state: {
          tracks: [
            {
              reciterId: '37761060-bd83-4b46-8fec-e71627eb0531',
              surahId: '1',
            },
          ],
        },
      }),
    );
    const value = await safeAsyncStorage.getItem('loved');
    expect(JSON.parse(value as string).state.tracks[0].reciterId).toBe(
      'b5312425-cc6b-4e53-b862-5b389c5dea94',
    );
  });
});
// @ai-end
