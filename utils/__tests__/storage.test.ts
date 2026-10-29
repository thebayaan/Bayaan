// @ai-start
// Locks the contract of `safeAsyncStorage`: a failed write is logged and
// reported once, and never rejects, so zustand `persist` cannot turn a full
// disk into an unhandled rejection on every state change (BAYAAN-6J).
// Sentry and AsyncStorage are the root __mocks__ stubs.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import {
  persistStorage,
  resetWriteFailureReportForTests,
  safeAsyncStorage,
} from '../storage';

const outOfSpace = new Error(
  'Failed to write value. NSCocoaErrorDomain Code=640 out of space',
);

// The AsyncStorage stub's methods are jest.fn wrappers around an in-memory
// map, so a test overrides them with a rejection and afterEach puts the
// in-memory implementation back.
const realSetItem = jest.mocked(AsyncStorage.setItem).getMockImplementation();
const realRemoveItem = jest
  .mocked(AsyncStorage.removeItem)
  .getMockImplementation();

afterEach(() => {
  jest.mocked(AsyncStorage.setItem).mockImplementation(realSetItem);
  jest.mocked(AsyncStorage.removeItem).mockImplementation(realRemoveItem);
  jest.restoreAllMocks();
});

describe('safeAsyncStorage', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.mocked(Sentry.captureMessage).mockClear();
    resetWriteFailureReportForTests();
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
    resetWriteFailureReportForTests();
  });

  it('round-trips JSON state the way persist stores it', async () => {
    const store = persistStorage<{count: number}>();
    const value = {state: {count: 3}, version: 1};

    await store?.setItem('json', value);

    expect(await store?.getItem('json')).toEqual(value);
    expect(await store?.getItem('missing')).toBeNull();
  });

  it('does not reject when the underlying write fails', async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValue(outOfSpace);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = persistStorage<{count: number}>();

    await expect(
      store?.setItem('json', {state: {count: 1}, version: 0}),
    ).resolves.toBeUndefined();
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
