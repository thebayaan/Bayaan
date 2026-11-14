// @ai-generated
const mockStorage = new Map<string, string | boolean>();
const mockRestartApp = jest.fn();
const mockReload = jest.fn();
let mockCanRestartApp = true;
const mockDirection = {
  isRTL: false,
  doLeftAndRightSwapInRTL: true,
  allowRTL: jest.fn(),
  forceRTL: jest.fn(),
  swapLeftAndRightInRTL: jest.fn(),
};

jest.mock('react-native', () => ({
  I18nManager: mockDirection,
  Platform: {OS: 'android'},
}));
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockStorage.get(key),
    set: (key: string, value: string | boolean) => mockStorage.set(key, value),
    remove: (key: string) => mockStorage.delete(key),
  }),
}));
jest.mock('expo', () => ({reloadAppAsync: mockReload}));
let mockDeviceLanguage = 'en';
jest.mock('expo-localization', () => ({
  getLocales: () => [{languageCode: mockDeviceLanguage}],
}));
jest.mock('@/modules/bayaan-restart', () => ({
  get canRestartApp() {
    return mockCanRestartApp;
  },
  restartApp: (rtl: boolean) => mockRestartApp(rtl),
}));

function loadRestart() {
  return require('../restart') as typeof import('../restart');
}

// SDK 57 installs a lazy native fetch getter. These isolated tests stub React
// Native and never fetch; avoid loading native networking while Jest resets
// the module registry.
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: jest.fn(),
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockStorage.clear();
  mockCanRestartApp = true;
  mockDirection.isRTL = false;
  mockDirection.doLeftAndRightSwapInRTL = true;
  mockDeviceLanguage = 'en';
  mockRestartApp.mockReturnValue(true);
});

it('saves Arabic, then restarts the app process right to left', () => {
  expect(loadRestart().restartWithLanguage('ar')).toBe(true);
  expect(mockStorage.get('language_preference')).toBe('ar');
  expect(mockDirection.forceRTL).toHaveBeenCalledWith(true);
  expect(mockRestartApp).toHaveBeenCalledWith(true);
  expect(mockDirection.forceRTL.mock.invocationCallOrder[0]).toBeLessThan(
    mockRestartApp.mock.invocationCallOrder[0],
  );
  // A new process, never an in-process JS reload.
  expect(mockReload).not.toHaveBeenCalled();
});

it('restarts left to right when switching back to English', () => {
  mockStorage.set('language_preference', 'ar');
  mockDirection.isRTL = true;
  expect(loadRestart().restartWithLanguage('en')).toBe(true);
  expect(mockRestartApp).toHaveBeenCalledWith(false);
});

it('keeps the saved choice for the next launch when the restart fails', () => {
  mockRestartApp.mockReturnValue(false);
  expect(loadRestart().restartWithLanguage('ar')).toBe(false);
  expect(mockStorage.get('language_preference')).toBe('ar');
});

it.each([true, false])(
  'offers a restart only where the app can relaunch itself (%s)',
  available => {
    mockCanRestartApp = available;
    expect(loadRestart().canRestartToApplyLanguage).toBe(available);
  },
);

describe('a launch in the wrong native direction', () => {
  // A new process: modules load again and read the native flags afresh.
  function launch(nativeRTL: boolean): boolean {
    jest.resetModules();
    mockDirection.isRTL = nativeRTL;
    return loadRestart().restartIfDirectionMismatched();
  }

  it('restarts once into the direction of the new device language', () => {
    // Language System; the phone was switched from English to Arabic.
    mockDeviceLanguage = 'ar';
    expect(launch(false)).toBe(true);
    expect(mockRestartApp).toHaveBeenCalledWith(true);
    // The restart took: the next launch agrees and does not restart.
    expect(launch(true)).toBe(false);
    expect(mockRestartApp).toHaveBeenCalledTimes(1);
  });

  it('does not loop when the native direction refuses to change', () => {
    mockDeviceLanguage = 'ar';
    expect(launch(false)).toBe(true);
    expect(launch(false)).toBe(false);
    expect(launch(false)).toBe(false);
    expect(mockRestartApp).toHaveBeenCalledTimes(1);
  });

  it('restarts again after a later change the other way', () => {
    mockDeviceLanguage = 'ar';
    launch(false);
    launch(true);
    mockDeviceLanguage = 'en';
    expect(launch(true)).toBe(true);
    expect(mockRestartApp).toHaveBeenLastCalledWith(false);
    expect(launch(false)).toBe(false);
    expect(mockRestartApp).toHaveBeenCalledTimes(2);
  });

  it('restarts left to right on a phone in an RTL language the app lacks', () => {
    // A fresh install allows RTL, so a Persian phone starts native RTL while
    // the app falls back to English.
    mockDeviceLanguage = 'fa';
    expect(launch(true)).toBe(true);
    expect(mockRestartApp).toHaveBeenCalledWith(false);
  });

  it('leaves a launch alone when the directions agree', () => {
    mockStorage.set('language_preference', 'ar');
    expect(launch(true)).toBe(false);
    expect(mockRestartApp).not.toHaveBeenCalled();
  });

  it('does nothing where the app cannot relaunch itself', () => {
    mockCanRestartApp = false;
    mockDeviceLanguage = 'ar';
    expect(launch(false)).toBe(false);
    expect(mockRestartApp).not.toHaveBeenCalled();
    // Nothing recorded, so a build that can restart still gets its one try.
    mockCanRestartApp = true;
    expect(launch(false)).toBe(true);
  });
});
