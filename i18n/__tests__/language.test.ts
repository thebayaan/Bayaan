// @ai-generated
const mockStorage = new Map<string, string | boolean>();
const mockReload = jest.fn();
const mockUpdatesReload = jest.fn();
const mockDeviceLocales = jest.fn();
const mockAlert = jest.fn();
const mockDevReload = jest.fn();
const mockDirection = {
  isRTL: false,
  doLeftAndRightSwapInRTL: true,
  allowRTL: jest.fn(),
  forceRTL: jest.fn(),
  swapLeftAndRightInRTL: jest.fn(),
};

jest.mock('react-native', () => ({
  I18nManager: mockDirection,
  Alert: {alert: mockAlert},
  DevSettings: {reload: mockDevReload},
}));
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockStorage.get(key),
    set: (key: string, value: string | boolean) => mockStorage.set(key, value),
    remove: (key: string) => mockStorage.delete(key),
  }),
}));
jest.mock('expo', () => ({reloadAppAsync: mockReload}));
jest.mock('expo-updates', () => ({reloadAsync: mockUpdatesReload}));
jest.mock('expo-localization', () => ({getLocales: mockDeviceLocales}));

function loadLanguage() {
  return require('../language') as typeof import('../language');
}

// SDK 57 installs a lazy native fetch getter. These isolated language
// tests stub React Native and never fetch; avoid loading native networking
// while Jest resets the module registry.
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: jest.fn(),
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockStorage.clear();
  mockDirection.isRTL = false;
  mockDirection.doLeftAndRightSwapInRTL = true;
  mockDeviceLocales.mockReturnValue([{languageCode: 'en'}]);
  mockReload.mockResolvedValue(undefined);
  mockUpdatesReload.mockResolvedValue(undefined);
});

it('keeps startup imports free of reloads until the root mounts', () => {
  mockStorage.set('language_preference', 'ar');
  expect(loadLanguage().currentLanguage).toBe('ar');
  expect(mockReload).not.toHaveBeenCalled();
});

it.each(['ar', 'en'])('sets reading-aid defaults for %s', language => {
  mockStorage.set('language_preference', language);
  const loaded = loadLanguage();
  expect(loaded.defaultShowEnglishReadingAids).toBe(language === 'en');
  expect(loaded.defaultShowTransliteration).toBe(language === 'en');
});

it('falls back to English for a device language the app does not ship', () => {
  mockDeviceLocales.mockReturnValue([
    {languageCode: 'fr'},
    {languageCode: null},
  ]);
  expect(loadLanguage().currentLanguage).toBe('en');
});

it('treats an unknown stored preference as System', () => {
  mockStorage.set('language_preference', 'xx');
  expect(loadLanguage().getLanguagePreference()).toBe('system');
});

it('persists Arabic and enables native mirroring before reloading', async () => {
  await loadLanguage().setLanguagePreference('ar');
  expect(mockStorage.get('language_preference')).toBe('ar');
  expect(mockDirection.allowRTL).toHaveBeenCalledWith(true);
  expect(mockDirection.forceRTL).toHaveBeenCalledWith(true);
  expect(mockDirection.swapLeftAndRightInRTL).toHaveBeenCalledWith(true);
  expect(mockReload).toHaveBeenCalledTimes(1);
  expect(mockDirection.forceRTL.mock.invocationCallOrder[0]).toBeLessThan(
    mockReload.mock.invocationCallOrder[0],
  );
});

it('switches back to English on an Arabic device', async () => {
  mockDirection.isRTL = true;
  mockDeviceLocales.mockReturnValue([{languageCode: 'ar'}]);
  await loadLanguage().setLanguagePreference('en');
  expect(mockDirection.allowRTL).toHaveBeenCalledWith(false);
  expect(mockDirection.forceRTL).toHaveBeenCalledWith(false);
  expect(mockReload).toHaveBeenCalledTimes(1);
});

it('clears a stale native force flag even when cached isRTL already matches', () => {
  loadLanguage().bootstrapDirection();
  expect(mockDirection.forceRTL).toHaveBeenCalledWith(false);
  expect(mockReload).not.toHaveBeenCalled();
});

it('recovers the unfinished build that disabled left/right style mirroring', () => {
  mockStorage.set('language_preference', 'ar');
  mockDirection.isRTL = true;
  mockDirection.doLeftAndRightSwapInRTL = false;
  loadLanguage().bootstrapDirection();
  expect(mockDirection.swapLeftAndRightInRTL).toHaveBeenCalledWith(true);
  expect(mockReload).toHaveBeenCalledTimes(1);
});

it('reloads only once if the native runtime refuses the requested direction', () => {
  mockStorage.set('language_preference', 'ar');
  loadLanguage().bootstrapDirection();
  jest.resetModules();
  loadLanguage().bootstrapDirection();
  expect(mockReload).toHaveBeenCalledTimes(1);

  // A later successful launch clears the guard for the next system change.
  mockDirection.isRTL = true;
  jest.resetModules();
  loadLanguage().bootstrapDirection();
  mockDirection.isRTL = false;
  jest.resetModules();
  loadLanguage().bootstrapDirection();
  expect(mockReload).toHaveBeenCalledTimes(2);
});

it('resolves System again when the device language changes between launches', () => {
  expect(loadLanguage().currentLanguage).toBe('en');
  mockDeviceLocales.mockReturnValue([{languageCode: 'ar'}]);
  jest.resetModules();
  const language = loadLanguage();
  expect(language.currentLanguage).toBe('ar');
  language.bootstrapDirection();
  expect(mockReload).toHaveBeenCalledTimes(1);
});

it('does not reload when selecting a preference with the same language and direction', async () => {
  await loadLanguage().setLanguagePreference('en');
  expect(mockStorage.get('language_preference')).toBe('en');
  expect(mockReload).not.toHaveBeenCalled();
});

it('falls back to Updates and then the development reloader when needed', async () => {
  mockReload.mockRejectedValue(new Error('Unavailable'));
  mockUpdatesReload.mockRejectedValue(new Error('Unavailable'));
  await loadLanguage().setLanguagePreference('ar');
  expect(mockUpdatesReload).toHaveBeenCalledTimes(1);
  expect(mockDevReload).toHaveBeenCalledTimes(1);
});

it('keeps component direction and directional icons tied to the selected language', () => {
  mockStorage.set('language_preference', 'ar');
  // Native constants can still describe the previous runtime until reload.
  mockDirection.isRTL = false;
  const rtl = require('../../utils/rtl') as typeof import('../../utils/rtl');
  expect(rtl.appLayoutDirection).toEqual({direction: 'rtl'});
  expect(rtl.flipX).toEqual({transform: [{scaleX: -1}]});
  expect(rtl.forceLTR).toEqual({direction: 'ltr'});
  expect(rtl.latinLetterSpacing(2)).toBe(0);

  mockStorage.set('language_preference', 'en');
  mockDirection.isRTL = true;
  jest.resetModules();
  const ltr = require('../../utils/rtl') as typeof import('../../utils/rtl');
  expect(ltr.appLayoutDirection).toEqual({direction: 'ltr'});
  expect(ltr.flipX).toBeUndefined();
  expect(ltr.latinLetterSpacing(2)).toBe(2);
});
