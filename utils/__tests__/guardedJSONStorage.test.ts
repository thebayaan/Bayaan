// @ai-generated
import type {StateStorage} from 'zustand/middleware';
import {
  createGuardedJSONStorage,
  setPersistStorageErrorHandler,
} from '../guardedJSONStorage';

type Value = {state: {count: number}; version: number};

/**
 * In-memory string storage. Reads can fail for chosen keys, and can be held
 * open so a test can act while a read is in flight.
 */
function createFakeStorage() {
  const disk = new Map<string, string>();
  const failingReads = new Set<string>();
  const readError = new Error('read failed');
  const heldReads: Array<() => void> = [];
  let holdReads = false;

  const storage: StateStorage & {
    setItem: jest.Mock;
    removeItem: jest.Mock;
  } = {
    getItem: jest.fn((name: string) => {
      const settle = () =>
        failingReads.has(name)
          ? Promise.reject(readError)
          : Promise.resolve(disk.get(name) ?? null);
      if (!holdReads) {
        return settle();
      }
      return new Promise<string | null>((resolve, reject) => {
        heldReads.push(() => settle().then(resolve, reject));
      });
    }),
    setItem: jest.fn(async (name: string, value: string) => {
      disk.set(name, value);
    }),
    removeItem: jest.fn(async (name: string) => {
      disk.delete(name);
    }),
  };

  return {
    disk,
    failingReads,
    readError,
    storage,
    holdReads: () => {
      holdReads = true;
    },
    releaseReads: () => {
      holdReads = false;
      heldReads.splice(0).forEach(release => release());
    },
  };
}

const value = (count: number): Value => ({state: {count}, version: 0});
const json = (count: number) => JSON.stringify(value(count));

describe('createGuardedJSONStorage', () => {
  const onError = jest.fn();

  beforeEach(() => {
    onError.mockReset();
    setPersistStorageErrorHandler(onError);
  });

  afterAll(() => {
    setPersistStorageErrorHandler(null);
  });

  it('round-trips JSON like createJSONStorage', async () => {
    const {disk, storage} = createFakeStorage();
    const guarded = createGuardedJSONStorage<Value['state']>(storage);

    await guarded.setItem('store', value(1));

    expect(disk.get('store')).toBe(json(1));
    await expect(guarded.getItem('store')).resolves.toEqual(value(1));
    expect(onError).not.toHaveBeenCalled();
  });

  it('treats a missing key (fresh install) as a successful read', async () => {
    const {disk, storage} = createFakeStorage();
    const guarded = createGuardedJSONStorage<Value['state']>(storage);

    await expect(guarded.getItem('store')).resolves.toBeNull();
    await guarded.setItem('store', value(1));

    expect(disk.get('store')).toBe(json(1));
  });

  it('does not write or remove a key whose read failed', async () => {
    const {disk, failingReads, readError, storage} = createFakeStorage();
    disk.set('store', json(42));
    failingReads.add('store');
    const guarded = createGuardedJSONStorage<Value['state']>(storage);

    await expect(guarded.getItem('store')).rejects.toBe(readError);
    await guarded.setItem('store', value(0));
    await guarded.removeItem('store');

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(disk.get('store')).toBe(json(42));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('read', 'store', readError);
  });

  it('drops a write made while a read that then fails was in flight', async () => {
    const fake = createFakeStorage();
    fake.disk.set('store', json(42));
    fake.failingReads.add('store');
    fake.holdReads();
    const guarded = createGuardedJSONStorage<Value['state']>(fake.storage);

    const read = guarded.getItem('store');
    await guarded.setItem('store', value(0));
    fake.releaseReads();
    await expect(read).rejects.toBe(fake.readError);

    expect(fake.storage.setItem).not.toHaveBeenCalled();
    expect(fake.disk.get('store')).toBe(json(42));
  });

  it('sends the newest write made during a read once the read succeeds', async () => {
    const fake = createFakeStorage();
    fake.holdReads();
    const guarded = createGuardedJSONStorage<Value['state']>(fake.storage);

    const read = guarded.getItem('store');
    await guarded.setItem('store', value(1));
    await guarded.setItem('store', value(2));
    expect(fake.storage.setItem).not.toHaveBeenCalled();

    fake.releaseReads();
    await read;

    expect(fake.storage.setItem).toHaveBeenCalledTimes(1);
    expect(fake.disk.get('store')).toBe(json(2));
  });

  it('cancels a held write when the key is removed during the read', async () => {
    const fake = createFakeStorage();
    fake.holdReads();
    const guarded = createGuardedJSONStorage<Value['state']>(fake.storage);

    const read = guarded.getItem('store');
    await guarded.setItem('store', value(1));
    await guarded.removeItem('store');
    fake.releaseReads();
    await read;

    expect(fake.storage.setItem).not.toHaveBeenCalled();
    expect(fake.disk.has('store')).toBe(false);
  });

  it('treats a synchronous throw from getItem as a failed read', async () => {
    const {disk, storage} = createFakeStorage();
    disk.set('store', json(42));
    const syncError = new Error('native module unavailable');
    storage.getItem = () => {
      throw syncError;
    };
    const guarded = createGuardedJSONStorage<Value['state']>(storage);

    await expect(guarded.getItem('store')).rejects.toBe(syncError);
    await guarded.setItem('store', value(0));

    expect(disk.get('store')).toBe(json(42));
  });

  it('keeps other keys writable when one key cannot be read', async () => {
    const {disk, failingReads, storage} = createFakeStorage();
    failingReads.add('broken');
    const guarded = createGuardedJSONStorage<Value['state']>(storage);

    await expect(guarded.getItem('broken')).rejects.toThrow();
    await expect(guarded.getItem('healthy')).resolves.toBeNull();
    await guarded.setItem('healthy', value(1));

    expect(disk.get('healthy')).toBe(json(1));
  });

  it('allows writes again after a later read of the key succeeds', async () => {
    const {disk, failingReads, storage} = createFakeStorage();
    disk.set('store', json(42));
    failingReads.add('store');
    const guarded = createGuardedJSONStorage<Value['state']>(storage);

    await expect(guarded.getItem('store')).rejects.toThrow();
    failingReads.delete('store');
    await expect(guarded.getItem('store')).resolves.toEqual(value(42));
    await guarded.setItem('store', value(43));

    expect(disk.get('store')).toBe(json(43));
  });

  it('reports a value that is not JSON and lets the next write replace it', async () => {
    const {disk, storage} = createFakeStorage();
    disk.set('store', '{not json');
    const guarded = createGuardedJSONStorage<Value['state']>(storage);

    await expect(guarded.getItem('store')).rejects.toThrow(SyntaxError);
    expect(onError).toHaveBeenCalledWith(
      'parse',
      'store',
      expect.any(SyntaxError),
    );

    await guarded.setItem('store', value(1));
    expect(disk.get('store')).toBe(json(1));
  });

  it('reports a failed write and still rejects with the original error', async () => {
    const {storage} = createFakeStorage();
    const writeError = new Error('disk full');
    storage.setItem.mockRejectedValueOnce(writeError);
    const guarded = createGuardedJSONStorage<Value['state']>(storage);

    await expect(guarded.setItem('store', value(1))).rejects.toBe(writeError);
    expect(onError).toHaveBeenCalledWith('write', 'store', writeError);
  });

  it('keeps the same storage behaviour when the error handler throws', async () => {
    setPersistStorageErrorHandler(() => {
      throw new Error('reporter failed');
    });
    const {disk, failingReads, readError, storage} = createFakeStorage();
    disk.set('store', json(42));
    failingReads.add('store');
    const guarded = createGuardedJSONStorage<Value['state']>(storage);

    await expect(guarded.getItem('store')).rejects.toBe(readError);
    await guarded.setItem('store', value(0));

    expect(disk.get('store')).toBe(json(42));
  });
});
