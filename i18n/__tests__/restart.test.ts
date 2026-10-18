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

jest.mock('react-native', () => ({I18nManager: mockDirection}));
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockStorage.get(key),
    set: (key: string, value: string | boolean) => mockStorage.set(key, value),
    remove: (key: string) => mockStorage.delete(key),
  }),
}));
jest.mock('expo', () => ({reloadAppAsync: mockReload}));
jest.mock('expo-localization', () => ({
  getLocales: () => [{languageCode: 'en'}],
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
