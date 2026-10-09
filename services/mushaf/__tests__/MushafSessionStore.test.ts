jest.mock('react-native-mmkv', () => {
  const mockStorage = new Map<string, unknown>();
  return {
    mockStorage,
    createMMKV: () => ({
      getBoolean: (key: string) => mockStorage.get(key),
      getNumber: (key: string) => mockStorage.get(key),
      set: (key: string, value: unknown) => mockStorage.set(key, value),
    }),
  };
});

jest.mock('@/services/sync/qfReadingSessionService', () => ({
  qfReadingSessionService: {
    recordPageIntent: jest.fn(),
    recordVisibleVerse: jest.fn(),
  },
}));

jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {
    getOrderedVerseKeysForPage: (page: number) => {
      if (page === 77) throw new Error('verse map unavailable');
      return page === 42 ? ['2:255'] : ['18:10'];
    },
  },
}));

import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {MushafSyncedReadingService} from '@/services/mushaf/MushafSyncedReadingService';
import {useQfSyncStore} from '@/store/qfSyncStore';

const mockRecordVisibleVerse = jest.mocked(
  require('@/services/sync/qfReadingSessionService').qfReadingSessionService
    .recordVisibleVerse,
);
const mockRecordPageIntent = jest.mocked(
  require('@/services/sync/qfReadingSessionService').qfReadingSessionService
    .recordPageIntent,
);

beforeEach(() => {
  require('react-native-mmkv').mockStorage.clear();
  mockRecordVisibleVerse.mockClear();
  mockRecordPageIntent.mockClear();
  useQfSyncStore.getState().resetForTesting();
});

it('prevents logout and account switches from leaking another scope while preserving the legacy guest page', () => {
  mushafSessionStore.setLastReadPage(7);

  useQfSyncStore.setState({activeAccountId: 'account-a'});
  mushafSessionStore.setLastReadPageFromSync('account-a', 42);

  useQfSyncStore.setState({activeAccountId: 'account-b'});
  expect(mushafSessionStore.getLastReadPage()).toBeNull();
  mushafSessionStore.setLastReadPageFromSync('account-b', 99);

  useQfSyncStore.setState({activeAccountId: 'account-a'});
  expect(mushafSessionStore.getLastReadPage()).toBe(42);
  useQfSyncStore.setState({activeAccountId: null});
  expect(mushafSessionStore.getLastReadPage()).toBe(7);
  useQfSyncStore.setState({activeAccountId: 'account-b'});
  expect(mushafSessionStore.getLastReadPage()).toBe(99);
});

it('prevents synced progress from recording a reading session or requesting an upload', () => {
  useQfSyncStore.setState({activeAccountId: 'account-a'});
  const syncRequestId = useQfSyncStore.getState().syncRequestId;

  mushafSessionStore.setLastReadPageFromSync('account-a', 42);

  expect(mushafSessionStore.getLastReadPage()).toBe(42);
  expect(mockRecordVisibleVerse).not.toHaveBeenCalled();
  expect(useQfSyncStore.getState().syncRequestId).toBe(syncRequestId);
});

it('keeps local page events immediate and enqueues only for the active authenticated account', () => {
  mushafSessionStore.setLastReadPage(7);
  expect(mockRecordPageIntent).not.toHaveBeenCalled();

  useQfSyncStore.setState({activeAccountId: 'account-a'});
  mushafSessionStore.setLastReadPage(42);

  expect(mushafSessionStore.getLastReadPage()).toBe(42);
  expect(mockRecordPageIntent).toHaveBeenCalledTimes(1);
  expect(mockRecordPageIntent).toHaveBeenCalledWith(
    '2:255',
    expect.any(Number),
  );
});

it('keeps a cache-only local page through a later stale sync after in-memory intent state is reconstructed', async () => {
  let localIntentRevision = 0;
  mockRecordPageIntent.mockImplementation(() => {
    localIntentRevision += 1;
  });
  useQfSyncStore.setState({activeAccountId: 'account-a'});
  mushafSessionStore.setLastReadPageFromSync('account-a', 42);
  mushafSessionStore.setLastReadPage(77);

  // A cold process loses the in-memory revision, while MMKV persists.
  localIntentRevision = 0;
  const reconstructedService = new MushafSyncedReadingService({
    database: {
      getLatestReadingLocation: async () => ({
        id: 'older-canonical-reading',
        ownerScope: 'qf:account-a',
        verseKey: '2:255',
        surahNumber: 2,
        ayahNumber: 255,
        lastReadAt: 1_000,
        createdAt: 1_000,
        updatedAt: 1_000,
      }),
    },
    resolveVersePage: async () => 42,
    getLocalIntentRevision: () => localIntentRevision,
  });

  await reconstructedService.applyCanonicalForAccount('account-a', 0);

  expect(mushafSessionStore.getLastReadPage()).toBe(77);
});

it('persists canonical last-read time through the default sync cache boundary', async () => {
  useQfSyncStore.setState({activeAccountId: 'account-a'});
  const service = new MushafSyncedReadingService({
    database: {
      getLatestReadingLocation: async () => ({
        id: 'newer-canonical-reading',
        ownerScope: 'qf:account-a',
        verseKey: '18:10',
        surahNumber: 18,
        ayahNumber: 10,
        lastReadAt: 5_000,
        createdAt: 5_000,
        updatedAt: 5_000,
      }),
    },
    resolveVersePage: async () => 293,
    getLocalIntentRevision: () => 0,
  });

  await service.applyCanonicalForAccount('account-a', 0);

  expect(mushafSessionStore.getLastReadPage()).toBe(293);
  expect(mushafSessionStore.getLastReadPageUpdatedAt('account-a')).toBe(5_000);
});
