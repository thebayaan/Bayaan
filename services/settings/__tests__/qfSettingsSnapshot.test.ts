jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// tafseerStore imports contentSync, whose analytics and notices need native modules.
// mockEngineTranslations: Bayaan's QF translations (true) or a fork's own
// provider (false, its ids are kept).
let mockEngineTranslations = false;
jest.mock('@/services/content/contentSync', () => ({
  getOfferedTafsirIds: async () => null,
  installContent: jest.fn(),
  removeContent: jest.fn(),
  isEngineManagingTafsir: () => false,
  isEngineInstallingTranslations: () => mockEngineTranslations,
}));

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

let mockDownloaded: {identifier: string}[] = [{identifier: 'ur.dummy'}];
jest.mock('@/store/translationStore', () => ({
  useTranslationStore: {
    getState: () => ({downloadedMeta: mockDownloaded}),
  },
}));

jest.mock('@/store/ambientStore', () => {
  const state = {
    currentSound: null,
    volume: 0.5,
    isEnabled: false,
    setVolume: (volume: number) => {
      state.volume = volume;
    },
  };
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

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    initialized: true,
    rewayah: 'hafs',
    switchRewayah: jest.fn(async () => undefined),
  },
}));

import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useThemeStore} from '@/store/themeStore';
import {
  applyRemotePreferences,
  applySettingsDocuments,
  capturePreferenceMutations,
  captureSettingsDocuments,
  sanitizeRemoteDocument,
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

  test('keeps a usable local translation until a cloud edition is downloaded', async () => {
    useMushafSettingsStore.getState().setSelectedTranslationId('saheeh');
    await applySettingsDocuments({
      mushaf: {selectedTranslationId: 'ur.not-downloaded'},
    });
    expect(useMushafSettingsStore.getState().selectedTranslationId).toBe(
      'saheeh',
    );
    await applySettingsDocuments({mushaf: {selectedTranslationId: 'ur.dummy'}});
    expect(useMushafSettingsStore.getState().selectedTranslationId).toBe(
      'ur.dummy',
    );
    await applySettingsDocuments({
      mushaf: {selectedTranslationId: 'clear-quran'},
    });
    expect(useMushafSettingsStore.getState().selectedTranslationId).toBe(
      'clear-quran',
    );
  });

  test('does not apply incompatible QF preference identifiers', async () => {
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

    await applySettingsDocuments({
      appearance: {themeMode: 'dark'},
      mushaf: {selectedTranslationId: 'clear-quran'},
    });
    expect(useThemeStore.getState().themeMode).toBe('dark');
    expect(useMushafSettingsStore.getState().selectedTranslationId).toBe(
      'clear-quran',
    );
  });

  describe('translation ids from before QF translations (spec 4.7)', () => {
    afterEach(() => {
      mockEngineTranslations = false;
      mockDownloaded = [{identifier: 'ur.dummy'}];
    });

    test('remote AlQuranCloud ids and saheeh map to the ids this device uses', () => {
      mockEngineTranslations = true;
      const project = (id: string) =>
        sanitizeRemoteDocument('mushaf', {selectedTranslationId: id})
          .selectedTranslationId;
      expect(project('en.pickthall')).toBe('19');
      expect(project('saheeh')).toBe('20');
      expect(project('en.asad')).toBe('clear-quran');
      expect(project('20')).toBe('20');
      expect(project('clear-quran')).toBe('clear-quran');
    });

    test('a fork keeps its provider ids; only saheeh moves to Clear Quran', () => {
      const project = (id: string) =>
        sanitizeRemoteDocument('mushaf', {selectedTranslationId: id})
          .selectedTranslationId;
      expect(project('en.pickthall')).toBe('en.pickthall');
      expect(project('saheeh')).toBe('clear-quran');
    });

    test('applies a remote AlQuranCloud id as its downloaded QF edition', async () => {
      mockEngineTranslations = true;
      mockDownloaded = [{identifier: '19'}];
      useMushafSettingsStore.getState().setSelectedTranslationId('clear-quran');
      await applySettingsDocuments({
        mushaf: {selectedTranslationId: 'en.pickthall'},
      });
      expect(useMushafSettingsStore.getState().selectedTranslationId).toBe(
        '19',
      );
    });

    test('never uploads an old id, even before this device migrated', () => {
      mockEngineTranslations = true;
      useMushafSettingsStore.getState().setSelectedTranslationId('saheeh');
      expect(captureSettingsDocuments().mushaf.selectedTranslationId).toBe(
        '20',
      );
      useMushafSettingsStore.getState().setSelectedTranslationId('en.itani');
      expect(captureSettingsDocuments().mushaf.selectedTranslationId).toBe(
        'clear-quran',
      );
    });
  });
});
