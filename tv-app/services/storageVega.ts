/**
 * The logic of Vega storage (services/storage.kepler.ts), kept free of the
 * Vega AsyncStorage import so it is unit-tested with a fake.
 *
 * The app reads storage synchronously (MMKV-style), so Vega keeps an
 * in-memory copy that hydrate() fills from AsyncStorage before the app loads
 * (see tv-vega/index.js). Writes go to memory at once and to AsyncStorage in
 * the background.
 */

/** The part of AsyncStorage this uses. */
export type AsyncStore = {
  getAllKeys(): Promise<readonly string[]>;
  multiGet(
    keys: readonly string[],
  ): Promise<readonly (readonly [string, string | null])[]>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
};

export const PREFIX = 'bayaan-tv:';

/**
 * Per-surah caches (verse timings, translations; see services/verseData).
 * They grow with listening, about 1 MB per translation edition, so they are
 * not read into memory at launch: preload() reads one when it is needed.
 */
export const LAZY_PREFIXES = ['bayaan_tv_ts_', 'bayaan_tv_tr_'];

const isLazy = (key: string): boolean =>
  LAZY_PREFIXES.some(p => key.startsWith(p));

export const HYDRATE_ATTEMPTS = 3;

export function createVegaStorage(
  store: AsyncStore,
  opts: {retryDelayMs?: number} = {},
) {
  const retryDelayMs = opts.retryDelayMs ?? 250;
  const values = new Map<string, string>();
  const listeners = new Set<(key: string) => void>();
  // Lazy keys looked up in AsyncStorage this session, with the read, so a
  // second caller for the same key waits for the first read instead of
  // seeing an empty cache while it runs.
  const looked = new Map<string, Promise<void>>();
  // After clearAll, stored lazy caches are on their way out: never read one.
  let lazyCleared = false;
  // False after a failed hydrate: memory then holds only what this session
  // wrote, and persisting it would overwrite the user's stored playlists,
  // loves and favourites with near-empty lists. So the session keeps its
  // writes in memory and leaves AsyncStorage as it was.
  let persistWrites = true;

  function notify(key: string): void {
    listeners.forEach(cb => cb(key));
  }

  function persist(task: () => Promise<void>): void {
    if (!persistWrites) return;
    task().catch((error: unknown) => {
      console.warn('[storage] AsyncStorage write failed', error);
    });
  }

  async function load(): Promise<void> {
    const keys = (await store.getAllKeys()).filter(
      k => k.startsWith(PREFIX) && !isLazy(k.slice(PREFIX.length)),
    );
    const entries = await store.multiGet(keys);
    for (const [fullKey, value] of entries) {
      const key = fullKey.slice(PREFIX.length);
      // A write made while a retry waited is newer than the stored value.
      if (value !== null && !values.has(key)) values.set(key, value);
    }
  }

  /**
   * Fills memory from AsyncStorage, trying HYDRATE_ATTEMPTS times. If every
   * attempt fails, the session runs without persisting (see persistWrites)
   * and the last error is thrown for the caller to log.
   */
  async function hydrate(): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= HYDRATE_ATTEMPTS; attempt++) {
      try {
        await load();
        return;
      } catch (error) {
        lastError = error;
        if (attempt < HYDRATE_ATTEMPTS) {
          await new Promise(r => setTimeout(r, retryDelayMs * attempt));
        }
      }
    }
    persistWrites = false;
    throw lastError;
  }

  /**
   * Reads one lazy cache key into memory, so the synchronous read after it
   * sees the stored value. Other keys are already in memory.
   */
  function preload(key: string): Promise<void> {
    if (!isLazy(key) || lazyCleared || values.has(key)) {
      return Promise.resolve();
    }
    let read = looked.get(key);
    if (!read) {
      const thisRead: Promise<void> = store
        .getItem(PREFIX + key)
        .then(value => {
          // A write, remove or clearAll while it ran is newer than the
          // stored value.
          const current = looked.get(key) === thisRead;
          if (value !== null && current && !values.has(key) && !lazyCleared) {
            values.set(key, value);
          }
        })
        .catch(() => {
          // A cache miss: the caller fetches it again.
        });
      read = thisRead;
      looked.set(key, read);
    }
    return read;
  }

  const storage = {
    getString: (key: string): string | undefined => values.get(key),
    set: (key: string, value: string | number | boolean): void => {
      const text = String(value);
      values.set(key, text);
      persist(() => store.setItem(PREFIX + key, text));
      notify(key);
    },
    remove: (key: string): void => {
      values.delete(key);
      looked.set(key, Promise.resolve());
      persist(() => store.removeItem(PREFIX + key));
      notify(key);
    },
    clearAll: (): void => {
      const keys = [...values.keys()];
      values.clear();
      lazyCleared = true;
      persist(async () => {
        // Lazy caches that were never read are cleared too.
        const all = (await store.getAllKeys()).filter(k =>
          k.startsWith(PREFIX),
        );
        await store.multiRemove(all);
      });
      keys.forEach(notify);
    },
    addOnValueChangedListener: (
      onValueChanged: (key: string) => void,
    ): {remove: () => void} => {
      listeners.add(onValueChanged);
      return {remove: (): void => void listeners.delete(onValueChanged)};
    },
  };

  return {storage, hydrate, preload, isPersisting: () => persistWrites};
}
