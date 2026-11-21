// @ai-generated
// The selected translation used to be applied to the shared verse data only
// by the audio player's verse list. With no track loaded, the Mushaf list
// view showed Saheeh International under the selected translation's name;
// after a restart a downloaded translation was a raw id with no text until
// Settings > Translations was opened. These run the startup steps of the
// "Translation DB" initializer against a real (file-backed) translations
// database.

import fs from 'fs';
import os from 'os';
import path from 'path';

jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/services/translation/TranslationApiService', () => ({
  translationApiService: {fetchFullTranslation: jest.fn()},
}));

interface App {
  /** Closes this launch's database handles: the app is killed. */
  quit: () => Promise<void>;
  translationDbService: typeof import('../TranslationDbService').translationDbService;
  useTranslationStore: typeof import('@/store/translationStore').useTranslationStore;
  useMushafSettingsStore: typeof import('@/store/mushafSettingsStore').useMushafSettingsStore;
  followSelectedTranslation: typeof import('../selectedTranslation').followSelectedTranslation;
  enhancedVersesBySurah: typeof import('@/utils/enhancedVerseData').enhancedVersesBySurah;
  getEnhancedVersesVersion: typeof import('@/utils/enhancedVersesVersion').getEnhancedVersesVersion;
  getTranslationName: typeof import('@/utils/translationLookup').getTranslationName;
  getTranslationTextRaw: typeof import('@/utils/translationLookup').getTranslationTextRaw;
}

// The device's database folder, kept across launches within one test.
let databaseDir = '';

/** A fresh JS runtime over the same database files: an app launch. */
function launch(): App {
  let app: App | undefined;
  jest.isolateModules(() => {
    const sqlite = require('@/test-utils/mockExpoSqlite');
    sqlite.useDatabaseDir(databaseDir);
    app = {
      quit: sqlite.closeOpenDatabases,
      translationDbService: require('../TranslationDbService')
        .translationDbService,
      useTranslationStore: require('@/store/translationStore')
        .useTranslationStore,
      useMushafSettingsStore: require('@/store/mushafSettingsStore')
        .useMushafSettingsStore,
      followSelectedTranslation: require('../selectedTranslation')
        .followSelectedTranslation,
      enhancedVersesBySurah: require('@/utils/enhancedVerseData')
        .enhancedVersesBySurah,
      getEnhancedVersesVersion: require('@/utils/enhancedVersesVersion')
        .getEnhancedVersesVersion,
      getTranslationName: require('@/utils/translationLookup')
        .getTranslationName,
      getTranslationTextRaw: require('@/utils/translationLookup')
        .getTranslationTextRaw,
    };
  });
  if (!app) throw new Error('modules not loaded');
  launched.push(app);
  return app;
}

/** The "Translation DB" step of AppInitializer. */
async function runTranslationStartup(app: App): Promise<void> {
  try {
    await app.translationDbService.initialize();
    await app.useTranslationStore.getState().loadDownloadedMeta();
  } finally {
    app.followSelectedTranslation();
  }
}

/** Lets the (unawaited) rebuild's database read and build finish. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise<void>(resolve => setImmediate(resolve));
  }
}

const firstVerse = (app: App): string | undefined =>
  app.enhancedVersesBySurah[1][0].translation;

const CLEAR_QURAN_1_1 =
  'In the Name of Allah—the Most Compassionate, Most Merciful.';

const launched: App[] = [];

beforeEach(() => {
  databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'translations-'));
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  for (const app of launched.splice(0)) await app.quit();
  fs.rmSync(databaseDir, {recursive: true, force: true});
  jest.restoreAllMocks();
});

describe('the selected translation at startup', () => {
  it('applies a bundled translation with no audio player on screen', async () => {
    const app = launch();
    expect(firstVerse(app)).toContain('In the name of Allāh,');
    app.useMushafSettingsStore.setState({selectedTranslationId: 'clear-quran'});
    await runTranslationStartup(app);
    await settle();
    expect(firstVerse(app)).toBe(CLEAR_QURAN_1_1);
  });

  it('applies the saved selection when the settings arrive after startup', async () => {
    const app = launch();
    await runTranslationStartup(app);
    await settle();
    expect(firstVerse(app)).toContain('In the name of Allāh,');
    // What hydration from storage does once the read resolves.
    app.useMushafSettingsStore.setState({selectedTranslationId: 'clear-quran'});
    await settle();
    expect(firstVerse(app)).toBe(CLEAR_QURAN_1_1);
  });

  it('still applies a bundled translation when the database cannot be opened', async () => {
    const app = launch();
    app.useMushafSettingsStore.setState({selectedTranslationId: 'clear-quran'});
    jest
      .spyOn(app.translationDbService, 'initialize')
      .mockRejectedValue(new Error('disk'));
    await expect(runTranslationStartup(app)).rejects.toThrow('disk');
    await settle();
    expect(firstVerse(app)).toBe(CLEAR_QURAN_1_1);
  });

  it('restores a downloaded translation after a restart: its name, its list entry and its text', async () => {
    // First run: the translation is downloaded.
    const first = launch();
    await first.translationDbService.initialize();
    await first.translationDbService.saveTranslation(
      'ur.jalandhry',
      'جالندہری',
      'Jalandhry',
      'ur',
      'rtl',
      [
        {verseKey: '1:1', surahNumber: 1, ayahNumber: 1, text: 'urdu 1:1'},
        {
          verseKey: '2:255',
          surahNumber: 2,
          ayahNumber: 255,
          text: 'urdu kursi',
        },
      ],
    );
    await first.quit();

    // Relaunch with it selected. Nobody opens Settings > Translations.
    const app = launch();
    app.useMushafSettingsStore.setState({
      selectedTranslationId: 'ur.jalandhry',
    });
    expect(app.getTranslationName('ur.jalandhry')).toBe('ur.jalandhry');
    await runTranslationStartup(app);
    await settle();

    expect(app.getTranslationName('ur.jalandhry')).toBe('Jalandhry');
    expect(
      app.useTranslationStore.getState().downloadedMeta.map(m => m.identifier),
    ).toEqual(['ur.jalandhry']);
    expect(firstVerse(app)).toBe('urdu 1:1');
    // Copy and share read this in-memory copy.
    expect(app.getTranslationTextRaw('2:255', 'ur.jalandhry')).toBe(
      'urdu kursi',
    );
  });
});

describe('a change of the selected translation', () => {
  it('rebuilds the verse data each time, and only then', async () => {
    const app = launch();
    await runTranslationStartup(app);
    await settle();
    const version = app.getEnhancedVersesVersion();

    app.useMushafSettingsStore.setState({selectedTranslationId: 'clear-quran'});
    await settle();
    expect(firstVerse(app)).toBe(CLEAR_QURAN_1_1);
    expect(app.getEnhancedVersesVersion()).toBe(version + 1);

    // Another setting changing is not a reason to rebuild 6,236 verses.
    app.useMushafSettingsStore.setState({showTranslation: false});
    await settle();
    expect(app.getEnhancedVersesVersion()).toBe(version + 1);

    app.useMushafSettingsStore.setState({selectedTranslationId: 'saheeh'});
    await settle();
    expect(firstVerse(app)).toContain('In the name of Allāh,');
    expect(app.getEnhancedVersesVersion()).toBe(version + 2);
  });

  it('follows once however often startup runs', async () => {
    const app = launch();
    await runTranslationStartup(app);
    await runTranslationStartup(app);
    await settle();
    const version = app.getEnhancedVersesVersion();
    app.useMushafSettingsStore.setState({selectedTranslationId: 'clear-quran'});
    await settle();
    expect(app.getEnhancedVersesVersion()).toBe(version + 1);
  });
});
