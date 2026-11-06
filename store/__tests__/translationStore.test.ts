import type {
  DownloadedTranslationMeta,
  RemoteTranslationEdition,
} from '@/types/translation';

let mockEngine = true;
let mockProvider: {
  fetchAvailableEditions: jest.Mock;
  fetchFullTranslation: jest.Mock;
} | null = null;
const mockOffered = jest.fn();
const mockInstall = jest.fn();
const mockRemove = jest.fn();
const mockDb = {
  getDownloadedTranslations: jest.fn(async () => [] as unknown[]),
  saveTranslation: jest.fn(async (..._args: unknown[]) => undefined),
  deleteTranslation: jest.fn(async (..._args: unknown[]) => undefined),
};
jest.mock('@/services/content/contentSync', () => ({
  isEngineInstallingTranslations: () => mockEngine,
  getOfferedTranslations: () => mockOffered(),
  installContent: (key: string) => mockInstall(key),
  removeContent: (key: string) => mockRemove(key),
}));
jest.mock('@/services/translation/TranslationApiService', () => ({
  getForkTranslationProvider: () => mockProvider,
}));
jest.mock('@/services/translation/TranslationDbService', () => ({
  translationDbService: {
    getDownloadedTranslations: () => mockDb.getDownloadedTranslations(),
    saveTranslation: (...args: unknown[]) => mockDb.saveTranslation(...args),
    deleteTranslation: (...args: unknown[]) =>
      mockDb.deleteTranslation(...args),
  },
}));

import {useTranslationStore} from '../translationStore';

function downloaded(
  identifier: string,
  englishName: string,
  language = 'english',
): DownloadedTranslationMeta {
  return {
    identifier,
    name: englishName,
    englishName,
    language,
    direction: 'ltr',
    downloadedAt: 1,
    verseCount: 6236,
  };
}

describe('store actions', () => {
  beforeEach(() => {
    mockEngine = true;
    mockProvider = null;
    jest.clearAllMocks();
    useTranslationStore.setState({
      downloadedMeta: [],
      offeredTranslations: null,
      downloadingId: null,
      downloadProgress: 0,
    });
  });

  it('loads the catalog from the cached manifest, or null before one loads', async () => {
    mockOffered.mockResolvedValueOnce(null);
    await useTranslationStore.getState().loadOfferedTranslations();
    expect(useTranslationStore.getState().offeredTranslations).toBeNull();
    mockOffered.mockResolvedValueOnce([
      {
        key: 'qf:translations:20',
        id: '20',
        meta: {name: 'Saheeh International', language: 'english'},
        bytes: 5,
      },
    ]);
    await useTranslationStore.getState().loadOfferedTranslations();
    expect(useTranslationStore.getState().offeredTranslations).toEqual([
      {
        id: '20',
        name: 'Saheeh International',
        author: null,
        language: 'English',
        bytes: 5,
      },
    ]);
  });

  it('downloads and deletes through content sync', async () => {
    mockDb.getDownloadedTranslations.mockResolvedValue([
      downloaded('20', 'Saheeh International'),
    ]);
    await useTranslationStore.getState().downloadTranslation('20');
    expect(mockInstall).toHaveBeenCalledWith('qf:translations:20');
    expect(useTranslationStore.getState().downloadedMeta).toHaveLength(1);
    await useTranslationStore.getState().deleteTranslation('20');
    expect(mockRemove).toHaveBeenCalledWith('qf:translations:20');
    expect(mockDb.deleteTranslation).not.toHaveBeenCalled();
  });

  it('rethrows a failed install and clears the indicator', async () => {
    mockInstall.mockRejectedValueOnce(new Error('download_ticket_404'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(
      useTranslationStore.getState().downloadTranslation('20'),
    ).rejects.toThrow('download_ticket_404');
    expect(useTranslationStore.getState().downloadingId).toBeNull();
  });

  it('a fork provider lists and downloads its own editions (RFC-009)', async () => {
    mockEngine = false;
    const edition: RemoteTranslationEdition = {
      identifier: 'en.custom',
      language: 'en',
      name: 'Custom',
      englishName: 'Custom',
      format: 'text',
      type: 'translation',
      direction: 'ltr',
    };
    mockProvider = {
      fetchAvailableEditions: jest.fn(async () => [edition]),
      fetchFullTranslation: jest.fn(async () => ({edition, verses: []})),
    };
    await useTranslationStore.getState().loadOfferedTranslations();
    expect(useTranslationStore.getState().offeredTranslations).toHaveLength(1);
    await useTranslationStore.getState().downloadTranslation('en.custom');
    expect(mockProvider.fetchFullTranslation).toHaveBeenCalled();
    expect(mockDb.saveTranslation).toHaveBeenCalledWith(
      'en.custom',
      'Custom',
      'Custom',
      'en',
      'ltr',
      [],
    );
    expect(mockInstall).not.toHaveBeenCalled();
    await useTranslationStore.getState().deleteTranslation('en.custom');
    expect(mockDb.deleteTranslation).toHaveBeenCalledWith('en.custom');
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('offers nothing without the engine or a fork provider', async () => {
    mockEngine = false;
    await useTranslationStore.getState().loadOfferedTranslations();
    expect(useTranslationStore.getState().offeredTranslations).toBeNull();
  });
});
