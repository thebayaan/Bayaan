import {resetDatabases} from '@/test-utils/mockExpoSqlite';

jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);

// Fork behavior is pinned here: the content engine is not managing tafsir.
jest.mock('@/services/content/contentSync', () => ({
  installContent: jest.fn(),
  removeContent: jest.fn(),
  isEngineManagingTafsir: () => false,
}));

const mockFetchFullTafseer = jest.fn();
jest.mock('@/services/tafseer/TafseerApiService', () => ({
  tafseerApiService: {
    fetchFullTafseer: (...args: unknown[]) => mockFetchFullTafseer(...args),
  },
}));

type StoreModule = typeof import('../tafseerStore');
type DbModule = typeof import('@/services/tafseer/TafseerDbService');

interface Loaded {
  useTafseerStore: StoreModule['useTafseerStore'];
  tafseerDbService: DbModule['tafseerDbService'];
}

async function load(): Promise<Loaded> {
  let loaded: Loaded | undefined;
  jest.isolateModules(() => {
    loaded = {
      useTafseerStore: require('../tafseerStore').useTafseerStore,
      tafseerDbService: require('@/services/tafseer/TafseerDbService')
        .tafseerDbService,
    };
  });
  if (!loaded) throw new Error('modules not loaded');
  // The app initializes the DB at boot; the store itself never does.
  await loaded.tafseerDbService.initialize();
  return loaded;
}

function editionResult(identifier: string): {
  edition: {
    identifier: string;
    name: string;
    englishName: string;
    language: string;
    direction: 'ltr' | 'rtl';
  };
  verses: {
    surahNumber: number;
    ayahNumber: number;
    verseKey: string;
    text: string;
  }[];
} {
  return {
    edition: {
      identifier,
      name: `n${identifier}`,
      englishName: `e${identifier}`,
      language: 'English',
      direction: 'ltr',
    },
    verses: [{surahNumber: 1, ayahNumber: 1, verseKey: '1:1', text: 'x'}],
  };
}

beforeEach(async () => {
  await resetDatabases();
  mockFetchFullTafseer.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  mockFetchFullTafseer.mockReset();
});

describe('tafseerStore (characterization, develop behavior)', () => {
  it('defaults selectedTafseerId to 169', async () => {
    const {useTafseerStore} = await load();
    expect(useTafseerStore.getState().selectedTafseerId).toBe('169');
  });

  it('downloadTafseer saves, refreshes meta and keeps an existing selection', async () => {
    const {useTafseerStore} = await load();
    mockFetchFullTafseer.mockResolvedValue(editionResult('16'));
    await useTafseerStore.getState().downloadTafseer('16');
    const state = useTafseerStore.getState();
    expect(state.downloadedMeta.map(m => m.identifier)).toEqual(['16']);
    expect(state.downloadingId).toBeNull();
    expect(state.selectedTafseerId).toBe('169');
  });

  it('downloadTafseer auto-selects when nothing is selected', async () => {
    const {useTafseerStore} = await load();
    useTafseerStore.getState().setSelectedTafseerId(null);
    mockFetchFullTafseer.mockResolvedValue(editionResult('16'));
    await useTafseerStore.getState().downloadTafseer('16');
    expect(useTafseerStore.getState().selectedTafseerId).toBe('16');
  });

  it('downloadTafseer resets state and rethrows on failure', async () => {
    const {useTafseerStore} = await load();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockFetchFullTafseer.mockRejectedValue(new Error('boom'));
    await expect(
      useTafseerStore.getState().downloadTafseer('16'),
    ).rejects.toThrow('boom');
    expect(useTafseerStore.getState().downloadingId).toBeNull();
  });

  it('deleting the selected tafseer reselects the first remaining or null', async () => {
    const {useTafseerStore} = await load();
    mockFetchFullTafseer.mockImplementation(async (id: string) =>
      editionResult(id),
    );
    await useTafseerStore.getState().downloadTafseer('16');
    await useTafseerStore.getState().downloadTafseer('17');
    useTafseerStore.getState().setSelectedTafseerId('16');

    await useTafseerStore.getState().deleteTafseer('16');
    expect(useTafseerStore.getState().selectedTafseerId).toBe('17');

    await useTafseerStore.getState().deleteTafseer('17');
    expect(useTafseerStore.getState().selectedTafseerId).toBeNull();
  });

  it('deleting a non-selected tafseer keeps the selection', async () => {
    const {useTafseerStore} = await load();
    mockFetchFullTafseer.mockResolvedValue(editionResult('16'));
    await useTafseerStore.getState().downloadTafseer('16');
    await useTafseerStore.getState().deleteTafseer('16');
    expect(useTafseerStore.getState().selectedTafseerId).toBe('169');
  });
});
