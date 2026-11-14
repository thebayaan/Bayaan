// @ai-generated
/**
 * The preload waits for the saved mushaf settings so it loads the reader's
 * rewayah, not the default. That wait had no end: when the settings could not
 * be read (a locked device, a full disk) the app stayed on its splash screen.
 *
 * Real preload, real settings store and real data service; storage and
 * expo-sqlite are fakes whose reads can fail or be held. Every words DB holds
 * verse 1:1 tagged by DB (H1 H2 for Hafs, W1 W2 for Warsh, Q1 Q2 for Qalun).
 */
// Every launch below loads the store and the services afresh, which is slow
// on a busy machine.
jest.setTimeout(30000);

const mockDisk = new Map<string, string>();
// Runs before each storage read: reject to fail it, stay pending to hold it.
let mockBeforeRead: (() => Promise<void>) | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => {
    if (mockBeforeRead) await mockBeforeRead();
    return mockDisk.get(key) ?? null;
  },
  setItem: async (key: string, value: string) => {
    mockDisk.set(key, value);
  },
  removeItem: async (key: string) => {
    mockDisk.delete(key);
  },
}));

const mockSqlite = {
  files: new Set<string>(),
  // Reads of a DB base name wait for its gate.
  gates: new Map<string, Promise<void>>(),
  // DB base names whose reads always fail.
  broken: new Set<string>(),
};

jest.mock('expo-sqlite', () => {
  const TAGS: Record<string, string> = {
    dk_words: 'H',
    dk_words_warsh: 'W',
    dk_words_qaloon: 'Q',
  };
  const baseOf = (name: string) =>
    name.replace(/\.db$/, '').replace(/\.[0-9a-f]{8}$/, '');
  return {
    defaultDatabaseDirectory: '/data/user/0/app.test/files/SQLite',
    async openDatabaseAsync(name: string) {
      const base = baseOf(name);
      return {
        async getFirstAsync(sql: string) {
          if (!mockSqlite.files.has(name)) return null;
          return {name: /name='(\w+)'/.exec(sql)?.[1]};
        },
        async getAllAsync(sql: string) {
          const held = mockSqlite.gates.get(base);
          if (held) await held;
          if (mockSqlite.broken.has(base)) {
            throw new Error('database disk image is malformed');
          }
          if (sql.includes('FROM pages')) {
            return [
              {
                page_number: 1,
                line_number: 1,
                line_type: 'ayah',
                is_centered: 0,
                first_word_id: 1,
                last_word_id: 2,
                surah_number: 1,
              },
            ];
          }
          const tag = TAGS[base] ?? '?';
          return [
            {id: 1, text: `${tag}1`, location: '1:1:1'},
            {id: 2, text: `${tag}2`, location: '1:1:2'},
          ];
        },
        closeAsync: async () => undefined,
      };
    },
    async importDatabaseFromAssetAsync(name: string) {
      mockSqlite.files.add(name);
    },
    async deleteDatabaseAsync(name: string) {
      mockSqlite.files.delete(name);
    },
  };
});

// The settings store asks for the device language; the real module loads all
// of expo, which cannot be loaded a second time after jest.resetModules().
jest.mock('expo-localization', () => ({
  getLocales: () => [{languageCode: 'en'}],
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/app.test/files/',
  readDirectoryAsync: jest.fn(async () => []),
}));

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    TypefaceFontProvider: {Make: () => ({registerFont: () => undefined})},
    Data: {fromURI: async () => ({})},
    Typeface: {MakeFreeTypeFaceFromData: () => ({})},
  },
}));
jest.mock('../QuranTextService', () => ({
  quranTextService: {clearCaches: () => undefined},
}));
jest.mock('../RewayahDiffService', () => ({
  rewayahDiffService: {loadForRewayah: () => undefined},
}));

const KEY = 'mushaf-settings';
const WAIT_MS = 3000;

type App = {
  preload: typeof import('../MushafPreloadService').mushafPreloadService;
  dk: typeof import('../DigitalKhattDataService').digitalKhattDataService;
  settings: typeof import('@/store/mushafSettingsStore').useMushafSettingsStore;
};

/** A cold start: fresh singletons reading the same storage. */
function launch(): App {
  jest.resetModules();
  const {Image} = require('react-native');
  Image.resolveAssetSource = () => ({uri: 'file:///font.ttf'});
  return {
    settings: require('@/store/mushafSettingsStore').useMushafSettingsStore,
    dk: require('../DigitalKhattDataService').digitalKhattDataService,
    preload: require('../MushafPreloadService').mushafPreloadService,
  };
}

/** What a previous session saved: the reader's rewayah. */
function save(rewayah: string): void {
  mockDisk.set(
    KEY,
    JSON.stringify({
      state: {rewayah, mushafRenderer: 'dk_v2', uthmaniFont: 'v2'},
      version: 20,
    }),
  );
}

const savedRewayah = (): unknown =>
  JSON.parse(mockDisk.get(KEY) as string).state.rewayah;

/** Lets every pending promise chain run, without moving the clock. */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await jest.advanceTimersByTimeAsync(0);
  }
}

/** A promise and the function that resolves it. */
function gate(): {held: Promise<void>; open: () => void} {
  let open!: () => void;
  const held = new Promise<void>(resolve => {
    open = resolve;
  });
  return {held, open};
}

/** Starts the preload and tells whether it has finished. */
function startPreload(app: App): {finished: () => boolean} {
  let finished = false;
  app.preload.initialize().then(() => {
    finished = true;
  });
  return {finished: () => finished};
}

const storageUnreadable = async (): Promise<void> => {
  throw new Error('NSCocoaErrorDomain Code=257');
};

beforeEach(() => {
  jest.useFakeTimers();
  mockDisk.clear();
  mockBeforeRead = null;
  mockSqlite.files.clear();
  mockSqlite.gates.clear();
  mockSqlite.broken.clear();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  await flush();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('mushaf preload and the saved settings', () => {
  it('loads the saved rewayah as soon as the settings are in', async () => {
    save('warsh');
    const app = launch();

    const preload = startPreload(app);
    await flush();

    expect(preload.finished()).toBe(true);
    expect(app.preload.state).toBe('ready');
    expect(app.dk.getVerseText('1:1')).toBe('W1 W2');
    // No timer left behind to fire into a later screen.
    expect(jest.getTimerCount()).toBe(0);
  });

  it('goes on with the defaults when the settings cannot be read', async () => {
    save('warsh');
    mockBeforeRead = storageUnreadable;
    const app = launch();

    const preload = startPreload(app);
    await jest.advanceTimersByTimeAsync(WAIT_MS - 1);
    expect(preload.finished()).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await flush();

    // The boot step settles, so the splash screen can go.
    expect(preload.finished()).toBe(true);
    expect(app.preload.state).toBe('ready');
    expect(app.settings.persist.hasHydrated()).toBe(false);
    expect(app.dk.getVerseText('1:1')).toBe('H1 H2');
    // The defaults are never written over what the reader saved.
    expect(savedRewayah()).toBe('warsh');
  });

  it('shows the saved rewayah once a later read brings the settings', async () => {
    save('warsh');
    mockBeforeRead = storageUnreadable;
    const app = launch();
    startPreload(app);
    await jest.advanceTimersByTimeAsync(WAIT_MS);
    await flush();
    expect(app.dk.rewayah).toBe('hafs');

    // The retry on the next foreground (services/rehydrateOnForeground).
    mockBeforeRead = null;
    await app.settings.persist.rehydrate();
    await flush();

    expect(app.settings.getState().rewayah).toBe('warsh');
    expect(app.dk.rewayah).toBe('warsh');
    expect(app.dk.getVerseText('1:1')).toBe('W1 W2');
    expect(app.settings.getState().rewayahFallbackFrom).toBeNull();
    expect(savedRewayah()).toBe('warsh');
  });

  it('never commits the default text over a saved rewayah that arrives while it loads', async () => {
    save('warsh');
    const slowRead = gate();
    mockBeforeRead = () => slowRead.held;
    const hafsLoad = gate();
    mockSqlite.gates.set('dk_words', hafsLoad.held);
    const app = launch();

    const preload = startPreload(app);
    await jest.advanceTimersByTimeAsync(WAIT_MS);
    await flush();
    // Gave up waiting; the default (Hafs) text is loading.
    expect(app.dk.initialized).toBe(false);
    expect(app.dk.pendingRewayah).toBe('hafs');

    slowRead.open();
    await flush();
    expect(app.settings.getState().rewayah).toBe('warsh');

    hafsLoad.open();
    await flush();

    expect(preload.finished()).toBe(true);
    expect(app.preload.state).toBe('ready');
    expect(app.dk.rewayah).toBe('warsh');
    expect(app.dk.getVerseText('1:1')).toBe('W1 W2');
    expect(app.settings.getState().rewayah).toBe('warsh');
    expect(savedRewayah()).toBe('warsh');
  });

  it('keeps Hafs, named as Hafs, when the late saved rewayah cannot load', async () => {
    save('warsh');
    mockBeforeRead = storageUnreadable;
    const app = launch();
    startPreload(app);
    await jest.advanceTimersByTimeAsync(WAIT_MS);
    await flush();

    mockSqlite.broken.add('dk_words_warsh');
    mockBeforeRead = null;
    await app.settings.persist.rehydrate();
    await flush();

    // The same outcome as a launch where the saved rewayah fails: Hafs on
    // screen and in every label, the saved rewayah kept for the next launch.
    expect(app.dk.rewayah).toBe('hafs');
    expect(app.dk.getVerseText('1:1')).toBe('H1 H2');
    expect(app.settings.getState().rewayah).toBe('hafs');
    expect(app.settings.getState().rewayahFallbackFrom).toBe('warsh');
    expect(savedRewayah()).toBe('warsh');
  });

  it('falls back as a launch does when a saved rewayah arriving mid-load cannot load', async () => {
    save('warsh');
    const slowRead = gate();
    mockBeforeRead = () => slowRead.held;
    const hafsLoad = gate();
    mockSqlite.gates.set('dk_words', hafsLoad.held);
    mockSqlite.broken.add('dk_words_warsh');
    const app = launch();
    const preload = startPreload(app);
    await jest.advanceTimersByTimeAsync(WAIT_MS);
    await flush();

    slowRead.open();
    await flush();
    hafsLoad.open();
    await flush();

    expect(preload.finished()).toBe(true);
    expect(app.preload.state).toBe('ready');
    expect(app.dk.getVerseText('1:1')).toBe('H1 H2');
    expect(app.settings.getState().rewayah).toBe('hafs');
    expect(app.settings.getState().rewayahFallbackFrom).toBe('warsh');
    expect(savedRewayah()).toBe('warsh');
  });

  it('names the rewayah on screen when the late saved one cannot replace it', async () => {
    save('warsh');
    mockBeforeRead = storageUnreadable;
    const app = launch();
    startPreload(app);
    await jest.advanceTimersByTimeAsync(WAIT_MS);
    await flush();
    // The reader picks Qalun while the app runs on the defaults.
    await app.dk.switchRewayah('qalun');
    expect(app.settings.getState().rewayah).toBe('qalun');

    mockSqlite.broken.add('dk_words_warsh');
    mockBeforeRead = null;
    await app.settings.persist.rehydrate();
    await flush();

    expect(app.dk.getVerseText('1:1')).toBe('Q1 Q2');
    expect(app.settings.getState().rewayah).toBe('qalun');
    expect(app.settings.getState().rewayahFallbackFrom).toBeNull();
  });

  it('leaves a failed load to its retry, which reads the settings itself', async () => {
    save('warsh');
    mockBeforeRead = storageUnreadable;
    mockSqlite.broken.add('dk_words');
    const app = launch();
    startPreload(app);
    await jest.advanceTimersByTimeAsync(WAIT_MS);
    await flush();
    expect(app.preload.state).toBe('failed');
    expect(app.dk.initialized).toBe(false);

    const switchRewayah = jest.spyOn(app.dk, 'switchRewayah');
    mockBeforeRead = null;
    await app.settings.persist.rehydrate();
    await flush();
    expect(switchRewayah).not.toHaveBeenCalled();

    mockSqlite.broken.clear();
    startPreload(app);
    await flush();

    expect(app.preload.state).toBe('ready');
    expect(app.dk.getVerseText('1:1')).toBe('W1 W2');
  });

  it('a retried preload neither waits again nor follows the late settings twice', async () => {
    save('warsh');
    mockBeforeRead = storageUnreadable;
    mockSqlite.broken.add('dk_words');
    const app = launch();
    startPreload(app);
    await jest.advanceTimersByTimeAsync(WAIT_MS);
    await flush();
    expect(app.preload.state).toBe('failed');

    // The mushaf screen's retry, with the storage still unreadable.
    mockSqlite.broken.clear();
    const retry = startPreload(app);
    await flush();
    expect(retry.finished()).toBe(true);
    expect(app.preload.state).toBe('ready');
    expect(app.dk.rewayah).toBe('hafs');

    const switchRewayah = jest.spyOn(app.dk, 'switchRewayah');
    mockBeforeRead = null;
    await app.settings.persist.rehydrate();
    await flush();

    expect(switchRewayah).toHaveBeenCalledTimes(1);
    expect(app.dk.getVerseText('1:1')).toBe('W1 W2');
  });
});
