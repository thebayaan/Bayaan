// @ai-generated
// A downloaded translation is shown by name wherever it is captioned (the
// list view's rows, the Translation sheet). The names were registered only
// by the Translations screen, so in a session where it had not been opened
// the caption was the raw id ("ur.jalandhry"). The store now registers them
// wherever it loads the downloaded list.

import {resetDatabases} from '@/test-utils/mockExpoSqlite';

jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);

const mockFetchFullTranslation = jest.fn();
jest.mock('@/services/translation/TranslationApiService', () => ({
  translationApiService: {
    fetchFullTranslation: (...args: unknown[]) =>
      mockFetchFullTranslation(...args),
  },
}));

import {useTranslationStore} from '../translationStore';
import {translationDbService} from '@/services/translation/TranslationDbService';
import {getTranslationName} from '@/utils/translationLookup';

const verse = {
  verseKey: '1:1',
  surahNumber: 1,
  ayahNumber: 1,
  text: 'text 1:1',
};

beforeAll(async () => {
  await resetDatabases();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  // The app opens the database at startup; the store itself never does.
  await translationDbService.initialize();
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('names of downloaded translations', () => {
  it('are known as soon as the downloaded list is loaded', async () => {
    await translationDbService.saveTranslation(
      'ur.jalandhry',
      'جالندہری',
      'Jalandhry',
      'ur',
      'rtl',
      [verse],
    );
    expect(getTranslationName('ur.jalandhry')).toBe('ur.jalandhry');

    await useTranslationStore.getState().loadDownloadedMeta();

    expect(getTranslationName('ur.jalandhry')).toBe('Jalandhry');
    expect(
      useTranslationStore.getState().downloadedMeta.map(m => m.identifier),
    ).toEqual(['ur.jalandhry']);
  });

  it('are known as soon as a download finishes', async () => {
    mockFetchFullTranslation.mockResolvedValue({
      edition: {
        identifier: 'fr.hamidullah',
        name: 'Hamidullah',
        englishName: 'Muhammad Hamidullah',
        language: 'fr',
        direction: 'ltr',
      },
      verses: [verse],
    });
    expect(getTranslationName('fr.hamidullah')).toBe('fr.hamidullah');

    await useTranslationStore.getState().downloadTranslation('fr.hamidullah');

    expect(getTranslationName('fr.hamidullah')).toBe('Muhammad Hamidullah');
  });
});
