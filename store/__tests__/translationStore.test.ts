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

import {
  buildTranslationPicker,
  matchesTranslationQuery,
  offeredFromManifest,
  offeredFromProvider,
  useTranslationStore,
  type OfferedEdition,
} from '../translationStore';

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

const OFFERED: OfferedEdition[] = [
  {
    id: '20',
    name: 'Saheeh International',
    author: 'Saheeh International',
    language: 'English',
    bytes: 1_500_000,
  },
  {
    id: '19',
    name: 'Pickthall',
    author: 'M. Pickthall',
    language: 'English',
    bytes: 1_400_000,
  },
  {
    id: '31',
    name: 'Hamidullah',
    author: 'Muhammad Hamidullah',
    language: 'French',
    bytes: 1_600_000,
  },
  {
    id: '97',
    name: 'Tafheem-ul-Quran',
    author: 'Abul Ala Maududi',
    language: 'Urdu',
    bytes: 2_000_000,
  },
  {
    id: '45',
    name: 'Kuliev',
    author: 'Elmir Kuliev',
    language: 'Russian',
    bytes: 1_700_000,
  },
];

describe('offered editions', () => {
  it('maps manifest meta to picker editions with display languages', () => {
    expect(
      offeredFromManifest([
        {
          key: 'qf:translations:31',
          id: '31',
          meta: {
            name: 'Hamidullah',
            author: 'Muhammad Hamidullah',
            language: 'french',
          },
          bytes: 1000,
        },
        {
          key: 'qf:translations:99',
          id: '99',
          meta: undefined,
          bytes: undefined,
        },
      ]),
    ).toEqual([
      {
        id: '31',
        name: 'Hamidullah',
        author: 'Muhammad Hamidullah',
        language: 'French',
        bytes: 1000,
      },
      {
        id: '99',
        name: 'Translation 99',
        author: null,
        language: 'Other',
        bytes: null,
      },
    ]);
  });

  it('maps a fork provider edition list (RFC-009)', () => {
    const edition: RemoteTranslationEdition = {
      identifier: 'en.custom',
      language: 'en',
      name: 'Custom',
      englishName: 'Custom',
      format: 'text',
      type: 'translation',
      direction: 'ltr',
    };
    expect(offeredFromProvider([edition])).toEqual([
      {
        id: 'en.custom',
        name: 'Custom',
        author: null,
        language: 'English',
        bytes: null,
      },
    ]);
  });
});

describe('buildTranslationPicker', () => {
  it('lists installed editions first, then the catalog grouped by language, English first', () => {
    const picker = buildTranslationPicker({
      downloaded: [downloaded('20', 'Saheeh International')],
      offered: OFFERED,
      selectedId: 'clear-quran',
      query: '',
    });
    expect(picker.installed.map(row => row.id)).toEqual(['20']);
    expect(picker.groups.map(group => group.language)).toEqual([
      'English',
      'French',
      'Russian',
      'Urdu',
    ]);
    expect(picker.groups[0].rows.map(row => row.id)).toEqual(['19']);
    expect(picker.needsCatalog).toBe(false);
  });

  it('leaves the active edition out of the installed list and keeps Clear Quran in it', () => {
    const picker = buildTranslationPicker({
      downloaded: [downloaded('20', 'Saheeh International')],
      offered: OFFERED,
      selectedId: '20',
      query: '',
    });
    expect(picker.installed.map(row => row.id)).toEqual(['clear-quran']);
    expect(picker.installed[0]).toMatchObject({
      isBundled: true,
      author: 'Dr. Mustafa Khattab',
    });
  });

  it('names a downloaded edition from the manifest when it is listed there', () => {
    const picker = buildTranslationPicker({
      downloaded: [downloaded('19', 'Pickthall (old)', 'en')],
      offered: OFFERED,
      selectedId: 'clear-quran',
      query: '',
    });
    expect(picker.installed.find(row => row.id === '19')).toMatchObject({
      name: 'Pickthall',
      author: 'M. Pickthall',
      language: 'English',
    });
  });

  it('searches name, author and language', () => {
    const ids = (query: string) => {
      const picker = buildTranslationPicker({
        downloaded: [],
        offered: OFFERED,
        selectedId: '20',
        query,
      });
      return [
        ...picker.installed,
        ...picker.groups.flatMap(group => group.rows),
      ].map(row => row.id);
    };
    expect(ids('pick')).toEqual(['19']);
    // A selected edition that is not downloaded yet (the queued Saheeh
    // install) stays downloadable.
    expect(ids('saheeh')).toEqual(['20']);
    expect(ids('maududi')).toEqual(['97']);
    expect(ids('  FRENCH ')).toEqual(['31']);
    expect(ids('khattab')).toEqual(['clear-quran']);
    expect(ids('nothing like this')).toEqual([]);
  });

  it('before any catalog: installed editions and Clear Quran, plus the connect row', () => {
    const picker = buildTranslationPicker({
      downloaded: [downloaded('20', 'Saheeh International')],
      offered: null,
      selectedId: '20',
      query: '',
    });
    expect(picker.installed.map(row => row.id)).toEqual(['clear-quran']);
    expect(picker.groups).toEqual([]);
    expect(picker.needsCatalog).toBe(true);
  });

  it('matchesTranslationQuery matches everything on an empty query', () => {
    expect(
      matchesTranslationQuery({name: 'A', author: null, language: 'B'}, ' '),
    ).toBe(true);
  });
});

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
