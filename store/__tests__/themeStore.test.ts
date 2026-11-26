// @ai-generated
// The theme store is the only code that tells the native side which look the
// app uses. These tests run it on React Native's real `Appearance` module with
// a fake of the native module underneath, because the bugs lived between the
// two: what `Appearance` caches after each call, and when the native side
// reports a change.
type Scheme = 'light' | 'dark';

// Every launch below loads react-native afresh, which is slow on a busy
// machine.
jest.setTimeout(30000);

const mockDisk = new Map<string, string>();
let mockReadError: Error | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => {
    if (mockReadError) throw mockReadError;
    return mockDisk.get(key) ?? null;
  },
  setItem: async (key: string, value: string) => {
    mockDisk.set(key, value);
  },
  removeItem: async (key: string) => {
    mockDisk.delete(key);
  },
}));

/**
 * The native Appearance module as React Native 0.88 has it on iOS
 * (RCTAppearance.mm) and Android (AppearanceModule.kt):
 * - setColorScheme() only queues the change for the main / UI thread;
 * - getColorScheme() answers with the scheme last applied, so right after a
 *   setColorScheme() it is still the old one;
 * - applying a change sends `appearanceChanged` only when the app's scheme
 *   really changed.
 * 'light' and 'dark' pin the scheme; anything else removes the pin.
 */
const mockNative = {
  device: 'light' as Scheme,
  pin: null as Scheme | null,
  reported: 'light' as Scheme,
  queued: [] as unknown[],
  getColorScheme: jest.fn((): Scheme => mockNative.reported),
  setColorScheme: jest.fn((style: unknown): void => {
    mockNative.queued.push(style);
  }),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

jest.mock('react-native/Libraries/Utilities/NativeAppearance', () => ({
  __esModule: true,
  default: mockNative,
}));

const KEY = 'theme-storage';

type App = {
  store: typeof import('../themeStore').useThemeStore;
  Appearance: typeof import('react-native').Appearance;
  /** Lets the native side apply what was queued and report the result. */
  runNative: () => void;
  /** The device switches between light and dark (e.g. at sunset). */
  setDevice: (scheme: Scheme) => void;
};

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

/** A cold start: fresh modules, nothing pinned, the saved choice on disk. */
async function launch(options: {
  os: 'ios' | 'android';
  device: Scheme;
  saved?: 'light' | 'dark' | 'system';
}): Promise<App> {
  mockNative.device = options.device;
  mockNative.pin = null;
  mockNative.reported = options.device;
  mockNative.queued = [];
  if (options.saved) {
    mockDisk.set(
      KEY,
      JSON.stringify({
        state: {themeMode: options.saved, primaryColor: 'Blue'},
        version: 0,
      }),
    );
  }

  // A fresh registry for the whole launch, not jest.isolateModules:
  // react-native loads its parts on first use, and the store first uses some
  // of them after its module has loaded (when the saved choice arrives).
  jest.resetModules();
  const RN: typeof import('react-native') = require('react-native');
  RN.Platform.OS = options.os;
  const report = () => {
    const next = mockNative.pin ?? mockNative.device;
    if (next === mockNative.reported) return;
    mockNative.reported = next;
    RN.DeviceEventEmitter.emit('appearanceChanged', {colorScheme: next});
  };
  const app: App = {
    store: require('../themeStore').useThemeStore,
    Appearance: RN.Appearance,
    runNative: () => {
      for (const style of mockNative.queued.splice(0)) {
        mockNative.pin = style === 'light' || style === 'dark' ? style : null;
        report();
      }
    },
    setDevice: scheme => {
      mockNative.device = scheme;
      report();
    },
  };
  // The saved choice is read and applied, then the native side catches up.
  await settle();
  app.runNative();
  return app;
}

const isDark = (app: App) => app.store.getState().theme.isDarkMode;

beforeEach(() => {
  mockDisk.clear();
  mockReadError = null;
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe.each(['ios', 'android'] as const)('theme store on %s', os => {
  it('starts dark in System mode on a dark device, and React Native still knows the scheme', async () => {
    const app = await launch({os, device: 'dark', saved: 'system'});

    expect(isDark(app)).toBe(true);
    // Nothing was pinned in this run, so there is nothing to tell the native
    // side: it stays as the OS started it.
    expect(mockNative.setColorScheme).not.toHaveBeenCalled();
    // null here is what made screens that ask React Native (Reading Theme,
    // the error screen) draw light inside a dark app.
    expect(app.Appearance.getColorScheme()).toBe('dark');
  });

  it('pins a saved Dark on a light device at launch', async () => {
    const app = await launch({os, device: 'light', saved: 'dark'});

    expect(isDark(app)).toBe(true);
    expect(app.store.getState().themeMode).toBe('dark');
    expect(mockNative.pin).toBe('dark');
  });

  it('goes back to the light device when Dark is changed to System', async () => {
    const app = await launch({os, device: 'light', saved: 'dark'});

    app.store.getState().setThemeMode('system');

    // Until the native side answers, the app keeps the look it had.
    expect(app.store.getState().themeMode).toBe('system');
    expect(isDark(app)).toBe(true);

    app.runNative();

    expect(mockNative.pin).toBeNull();
    expect(isDark(app)).toBe(false);
    expect(app.Appearance.getColorScheme()).toBe('light');
  });

  it('goes back to the dark device when Light is changed to System', async () => {
    const app = await launch({os, device: 'dark', saved: 'light'});
    expect(isDark(app)).toBe(false);

    app.store.getState().setThemeMode('system');
    app.runNative();

    expect(mockNative.pin).toBeNull();
    expect(isDark(app)).toBe(true);
    expect(app.Appearance.getColorScheme()).toBe('dark');
  });

  it('stays dark, with a known scheme, when System matches the pinned Dark', async () => {
    const app = await launch({os, device: 'dark', saved: 'dark'});

    app.store.getState().setThemeMode('system');
    app.runNative();

    // The scheme did not change, so the native side sends no event.
    expect(mockNative.pin).toBeNull();
    expect(isDark(app)).toBe(true);
    expect(app.Appearance.getColorScheme()).toBe('dark');
  });

  it('applies Light and Dark at once, whatever the device uses', async () => {
    const app = await launch({os, device: 'light', saved: 'system'});

    app.store.getState().setThemeMode('dark');
    expect(isDark(app)).toBe(true);
    app.runNative();
    expect(mockNative.pin).toBe('dark');
    expect(isDark(app)).toBe(true);

    app.store.getState().setThemeMode('light');
    expect(isDark(app)).toBe(false);
    app.runNative();
    expect(mockNative.pin).toBe('light');
    expect(isDark(app)).toBe(false);
  });

  it('follows the device in System mode and ignores it under Light or Dark', async () => {
    const app = await launch({os, device: 'light', saved: 'system'});

    app.setDevice('dark');
    expect(isDark(app)).toBe(true);
    app.setDevice('light');
    expect(isDark(app)).toBe(false);

    app.store.getState().setThemeMode('dark');
    app.runNative();
    app.setDevice('dark');
    app.setDevice('light');
    expect(isDark(app)).toBe(true);
  });

  it('only ever sends light, dark or unspecified to the native side', async () => {
    const app = await launch({os, device: 'dark', saved: 'system'});

    app.store.getState().setThemeMode('light');
    app.store.getState().setThemeMode('dark');
    app.store.getState().setThemeMode('system');
    app.runNative();

    expect(
      mockNative.setColorScheme.mock.calls.map(([style]) => style),
    ).toEqual(['light', 'dark', 'unspecified']);
    expect(isDark(app)).toBe(true);
  });

  it('saves the chosen mode, not the resolved theme', async () => {
    const app = await launch({os, device: 'dark'});

    app.store.getState().setThemeMode('light');
    await settle();

    expect(JSON.parse(mockDisk.get(KEY) as string).state).toEqual({
      themeMode: 'light',
      primaryColor: 'Blue',
    });
  });

  it('removes a look pinned meanwhile when a late read brings a saved System', async () => {
    mockReadError = new Error('NSCocoaErrorDomain Code=257');
    const app = await launch({os, device: 'light', saved: 'system'});
    app.store.getState().setThemeMode('dark');
    app.runNative();
    expect(mockNative.pin).toBe('dark');

    // The retry on the next foreground (services/rehydrateOnForeground).
    mockReadError = null;
    await app.store.persist.rehydrate();
    app.runNative();

    expect(app.store.getState().themeMode).toBe('system');
    expect(mockNative.pin).toBeNull();
    expect(isDark(app)).toBe(false);
  });

  it('leaves the native side alone when the saved choice cannot be read', async () => {
    mockReadError = new Error('NSCocoaErrorDomain Code=257');
    const app = await launch({os, device: 'dark', saved: 'light'});

    expect(mockNative.setColorScheme).not.toHaveBeenCalled();
    expect(app.store.getState().themeMode).toBe('system');
    expect(isDark(app)).toBe(true);
  });
});
