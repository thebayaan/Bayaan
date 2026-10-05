jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/services/player/store/playerStore', () => {
  const state = {
    settings: {repeatMode: 'none', shuffle: false, skipSilence: false},
  };
  return {
    usePlayerStore: {
      getState: () => state,
      setState: (patch: typeof state) => Object.assign(state, patch),
    },
  };
});

jest.mock('@/store/ambientStore', () => {
  const state = {currentSound: null, volume: 0.5};
  return {
    useAmbientStore: {
      getState: () => state,
      setState: (patch: Partial<typeof state>) => Object.assign(state, patch),
    },
  };
});

jest.mock('@/store/mushafPlayerStore', () => {
  const state = {
    rewayatId: 'hafs',
    reciterName: 'Test reciter',
    rate: 1,
    verseRepeatCount: 1,
    rangeRepeatCount: 1,
    setRate: (rate: number) => {
      state.rate = rate;
    },
  };
  return {
    useMushafPlayerStore: {
      getState: () => state,
      setState: (patch: Partial<typeof state>) => Object.assign(state, patch),
    },
  };
});

import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useThemeStore} from '@/store/themeStore';
import {
  applyRemotePreferences,
  applySettingsDocuments,
  capturePreferenceMutations,
  captureSettingsDocuments,
} from '../qfSettingsSnapshot';

describe('QF settings snapshot mapping', () => {
  const originalThemeMode = useThemeStore.getState().themeMode;
  const originalTranslationId =
    useMushafSettingsStore.getState().selectedTranslationId;

  afterEach(() => {
    useThemeStore.getState().setThemeMode(originalThemeMode);
    useMushafSettingsStore
      .getState()
      .setSelectedTranslationId(originalTranslationId);
  });

  test('keeps non-lossless theme and translation identifiers in App State', () => {
    useThemeStore.getState().setThemeMode('dark');
    useMushafSettingsStore.getState().setSelectedTranslationId('clear-quran');

    const documents = captureSettingsDocuments();
    const preferences = capturePreferenceMutations();

    expect(documents.appearance.themeMode).toBe('dark');
    expect(documents.mushaf.selectedTranslationId).toBe('clear-quran');
    expect(preferences.some(item => item.group === 'theme')).toBe(false);
    expect(
      preferences.some(
        item =>
          item.group === 'reading' && item.key === 'selectedReadingTranslation',
      ),
    ).toBe(false);
  });

  test('does not apply incompatible QF preference identifiers', () => {
    useThemeStore.getState().setThemeMode('light');
    useMushafSettingsStore.getState().setSelectedTranslationId('saheeh');

    applyRemotePreferences({
      theme: {type: 'sepia'},
      reading: {selectedReadingTranslation: '131'},
    });

    expect(useThemeStore.getState().themeMode).toBe('light');
    expect(useMushafSettingsStore.getState().selectedTranslationId).toBe(
      'saheeh',
    );

    applySettingsDocuments({
      appearance: {themeMode: 'dark'},
      mushaf: {selectedTranslationId: 'clear-quran'},
    });
    expect(useThemeStore.getState().themeMode).toBe('dark');
    expect(useMushafSettingsStore.getState().selectedTranslationId).toBe(
      'clear-quran',
    );
  });
});
