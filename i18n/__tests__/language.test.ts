// @ai-generated
const mockStorage = new Map<string, string | boolean>();
const mockReload = jest.fn();
const mockUpdatesReload = jest.fn();
const mockDeviceLocales = jest.fn();
const mockAlert = jest.fn();
const mockDevReload = jest.fn();
const mockSettingsSet = jest.fn();
const mockPlatform = {OS: 'android'};
const mockDirection = {
  isRTL: false,
  doLeftAndRightSwapInRTL: true,
  allowRTL: jest.fn(),
  forceRTL: jest.fn(),
  swapLeftAndRightInRTL: jest.fn(),
};

jest.mock('react-native', () => ({
  I18nManager: mockDirection,
  Platform: mockPlatform,
  Settings: {set: mockSettingsSet},
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
  mockPlatform.OS = 'android';
  mockDirection.isRTL = false;
  mockDirection.doLeftAndRightSwapInRTL = true;
  mockDeviceLocales.mockReturnValue([{languageCode: 'en'}]);
  mockReload.mockResolvedValue(undefined);
  mockUpdatesReload.mockResolvedValue(undefined);
});

it('keeps startup imports free of reloads', () => {
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

// In-process reloads (reloadAppAsync, Updates.reloadAsync, DevSettings.reload)
// crash on React Native 0.86 bridgeless: the old runtime can run a pending
// Fabric render after its scheduler is torn down. Direction changes are
// persisted natively and applied on the next launch instead.
function expectNoReload() {
  expect(mockReload).not.toHaveBeenCalled();
  expect(mockUpdatesReload).not.toHaveBeenCalled();
  expect(mockDevReload).not.toHaveBeenCalled();
}

it('persists Arabic and native mirroring without reloading in process', () => {
  const restartRequired = loadLanguage().setLanguagePreference('ar');
  expect(restartRequired).toBe(true);
  expect(mockStorage.get('language_preference')).toBe('ar');
  expect(mockDirection.allowRTL).toHaveBeenCalledWith(true);
  expect(mockDirection.forceRTL).toHaveBeenCalledWith(true);
  expect(mockDirection.swapLeftAndRightInRTL).toHaveBeenCalledWith(true);
  expectNoReload();
});

it('switches back to English on an Arabic device without reloading', () => {
  mockDirection.isRTL = true;
  mockDeviceLocales.mockReturnValue([{languageCode: 'ar'}]);
  expect(loadLanguage().setLanguagePreference('en')).toBe(true);
  expect(mockDirection.allowRTL).toHaveBeenCalledWith(false);
  expect(mockDirection.forceRTL).toHaveBeenCalledWith(false);
  expectNoReload();
});

it('reports whether a preference needs a restart without saving it', () => {
  const language = loadLanguage();
  expect(language.languageChangeRequiresRestart('ar')).toBe(true);
  expect(language.languageChangeRequiresRestart('en')).toBe(false);
  expect(language.languageChangeRequiresRestart('system')).toBe(false);
  expect(mockStorage.get('language_preference')).toBeUndefined();
  expect(mockDirection.forceRTL).not.toHaveBeenCalled();
});

it('does not require a restart when the language and direction are unchanged', () => {
  expect(loadLanguage().setLanguagePreference('en')).toBe(false);
  expect(mockStorage.get('language_preference')).toBe('en');
  expectNoReload();
});

it('does not require a restart when switching back before relaunching', () => {
  mockStorage.set('language_preference', 'ar');
  mockDirection.isRTL = true;
  const language = loadLanguage();
  expect(language.setLanguagePreference('en')).toBe(true);
  // The user changes their mind before closing the app.
  expect(language.setLanguagePreference('ar')).toBe(false);
  expect(mockDirection.forceRTL).toHaveBeenLastCalledWith(true);
  expectNoReload();
});

it('clears a stale native force flag even when cached isRTL already matches', () => {
  loadLanguage().bootstrapDirection();
  expect(mockDirection.forceRTL).toHaveBeenCalledWith(false);
  expectNoReload();
});

it('repairs disabled left/right style mirroring for the next launch', () => {
  mockStorage.set('language_preference', 'ar');
  mockDirection.isRTL = true;
  mockDirection.doLeftAndRightSwapInRTL = false;
  loadLanguage().bootstrapDirection();
  expect(mockDirection.swapLeftAndRightInRTL).toHaveBeenCalledWith(true);
  expectNoReload();
});

it('never reloads at startup when the native direction disagrees', () => {
  mockStorage.set('language_preference', 'ar');
  loadLanguage().bootstrapDirection();
  jest.resetModules();
  loadLanguage().bootstrapDirection();
  expect(mockDirection.forceRTL).toHaveBeenCalledWith(true);
  expectNoReload();
});

it('resolves System again when the device language changes between launches', () => {
  expect(loadLanguage().currentLanguage).toBe('en');
  mockDeviceLocales.mockReturnValue([{languageCode: 'ar'}]);
  jest.resetModules();
  const language = loadLanguage();
  expect(language.currentLanguage).toBe('ar');
  language.bootstrapDirection();
  expect(mockDirection.forceRTL).toHaveBeenCalledWith(true);
  expectNoReload();
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

describe('on iOS, where Settings owns the app language', () => {
  beforeEach(() => {
    mockPlatform.OS = 'ios';
  });

  it('follows the language iOS launched the app with', () => {
    mockDeviceLocales.mockReturnValue([{languageCode: 'ar'}]);
    const language = loadLanguage();
    expect(language.languageFollowsSystemSettings).toBe(true);
    expect(language.currentLanguage).toBe('ar');
  });

  // A forced flag would outlive a language change made in Settings and start
  // the relaunched app in the old direction.
  it.each([
    ['ar', [{languageCode: 'ar'}]],
    ['en', [{languageCode: 'en'}]],
  ])(
    'lets iOS pick the direction for %s instead of forcing it',
    (_, locales) => {
      mockDeviceLocales.mockReturnValue(locales);
      loadLanguage().bootstrapDirection();
      expect(mockDirection.allowRTL).toHaveBeenCalledWith(true);
      expect(mockDirection.forceRTL).toHaveBeenCalledWith(false);
      expect(mockDirection.forceRTL).not.toHaveBeenCalledWith(true);
      expect(mockDirection.swapLeftAndRightInRTL).toHaveBeenCalledWith(true);
      expectNoReload();
    },
  );

  it('hands a language picked in the app to iOS Settings', () => {
    mockStorage.set('language_preference', 'ar');
    const language = loadLanguage();
    language.bootstrapDirection();
    // This session keeps the language it started with.
    expect(language.currentLanguage).toBe('ar');
    expect(mockSettingsSet).toHaveBeenCalledWith({AppleLanguages: ['ar']});
    expect(mockStorage.has('language_preference')).toBe(false);
    expectNoReload();
  });

  it('leaves iOS Settings alone when the app followed the system', () => {
    mockStorage.set('language_preference', 'system');
    loadLanguage().bootstrapDirection();
    expect(mockSettingsSet).not.toHaveBeenCalled();
    expect(mockStorage.get('language_preference')).toBe('system');
  });
});
