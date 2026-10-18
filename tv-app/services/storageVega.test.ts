import {createVegaStorage, PREFIX, type AsyncStore} from './storageVega';

function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial).map(([k, v]) => [PREFIX + k, v]));
  const store = {
    data,
    failReads: 0,
    getAllKeys: jest.fn(async () => {
      if (store.failReads > 0) {
        store.failReads--;
        throw new Error('storage unavailable');
      }
      return [...data.keys(), 'other-app:key'];
    }),
    multiGet: jest.fn(async (keys: readonly string[]) =>
      keys.map(k => [k, data.get(k) ?? null] as const),
    ),
    getItem: jest.fn(async (k: string) => data.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      data.set(k, v);
    }),
    removeItem: jest.fn(async (k: string) => {
      data.delete(k);
    }),
    multiRemove: jest.fn(async (keys: readonly string[]) => {
      keys.forEach(k => data.delete(k));
    }),
  };
  return store satisfies AsyncStore;
}

const flush = () => new Promise(r => setImmediate(r));

describe('Vega storage', () => {
  it('hydrates its own keys and persists writes', async () => {
    const store = fakeStore({playlists: '[1]'});
    const vega = createVegaStorage(store, {retryDelayMs: 0});
    await vega.hydrate();
    expect(vega.storage.getString('playlists')).toBe('[1]');
    expect(vega.storage.getString('other-app:key')).toBeUndefined();

    vega.storage.set('loved', '[2]');
    await flush();
    expect(store.data.get(PREFIX + 'loved')).toBe('[2]');
  });

  it('retries a failed hydrate', async () => {
    const store = fakeStore({playlists: '[1]'});
    store.failReads = 2;
    const vega = createVegaStorage(store, {retryDelayMs: 0});
    await vega.hydrate();
    expect(vega.storage.getString('playlists')).toBe('[1]');
    expect(vega.isPersisting()).toBe(true);
  });

  it('never overwrites stored data after hydrate fails for good', async () => {
    const store = fakeStore({playlists: '[1,2,3]'});
    store.failReads = 3;
    const vega = createVegaStorage(store, {retryDelayMs: 0});
    await expect(vega.hydrate()).rejects.toThrow('storage unavailable');
    expect(vega.isPersisting()).toBe(false);

    // The session still works from memory...
    vega.storage.set('playlists', '[9]');
    expect(vega.storage.getString('playlists')).toBe('[9]');
    vega.storage.remove('playlists');
    vega.storage.clearAll();
    await flush();
    // ...and the user's stored playlists are untouched.
    expect(store.data.get(PREFIX + 'playlists')).toBe('[1,2,3]');
    expect(store.setItem).not.toHaveBeenCalled();
    expect(store.removeItem).not.toHaveBeenCalled();
    expect(store.multiRemove).not.toHaveBeenCalled();
  });

  it('leaves per-surah caches out of the launch read and loads them on demand', async () => {
    const store = fakeStore({
      settings: '{}',
      bayaan_tv_ts_r1_2: '{"entries":[]}',
      bayaan_tv_tr_en_2: '["a"]',
    });
    const vega = createVegaStorage(store, {retryDelayMs: 0});
    await vega.hydrate();
    expect(store.multiGet.mock.calls[0][0]).toEqual([PREFIX + 'settings']);
    expect(vega.storage.getString('bayaan_tv_tr_en_2')).toBeUndefined();

    await vega.preload('bayaan_tv_tr_en_2');
    expect(vega.storage.getString('bayaan_tv_tr_en_2')).toBe('["a"]');
    // Looked up once per session; other keys never hit AsyncStorage.
    await vega.preload('bayaan_tv_tr_en_2');
    await vega.preload('bayaan_tv_tr_en_3');
    await vega.preload('settings');
    expect(store.getItem).toHaveBeenCalledTimes(2);
  });

  it('a second preload of the same key waits for the first read', async () => {
    const store = fakeStore({bayaan_tv_tr_en_2: '["a"]'});
    const vega = createVegaStorage(store, {retryDelayMs: 0});
    await vega.hydrate();
    const first = vega.preload('bayaan_tv_tr_en_2');
    await vega.preload('bayaan_tv_tr_en_2');
    expect(vega.storage.getString('bayaan_tv_tr_en_2')).toBe('["a"]');
    await first;
    expect(store.getItem).toHaveBeenCalledTimes(1);
  });

  it('a cache removed while its preload runs stays removed', async () => {
    const store = fakeStore({bayaan_tv_ts_r1_2: '{}'});
    const vega = createVegaStorage(store, {retryDelayMs: 0});
    await vega.hydrate();
    const reading = vega.preload('bayaan_tv_ts_r1_2');
    vega.storage.remove('bayaan_tv_ts_r1_2');
    await reading;
    expect(vega.storage.getString('bayaan_tv_ts_r1_2')).toBeUndefined();
  });

  it('clears unread caches too, and does not bring them back', async () => {
    const store = fakeStore({settings: '{}', bayaan_tv_ts_r1_2: '{}'});
    const vega = createVegaStorage(store, {retryDelayMs: 0});
    await vega.hydrate();
    vega.storage.clearAll();
    await vega.preload('bayaan_tv_ts_r1_2');
    expect(vega.storage.getString('bayaan_tv_ts_r1_2')).toBeUndefined();
    await flush();
    expect(store.data.size).toBe(0);
  });

  it('a write made during hydrate wins over the stored value', async () => {
    const store = fakeStore({onboarded: 'false'});
    store.failReads = 1;
    const vega = createVegaStorage(store, {retryDelayMs: 0});
    const hydrating = vega.hydrate();
    vega.storage.set('onboarded', 'true');
    await hydrating;
    expect(vega.storage.getString('onboarded')).toBe('true');
  });
});
