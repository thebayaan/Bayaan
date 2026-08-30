import {MushafSyncedReadingService} from '@/services/mushaf/MushafSyncedReadingService';

function readingLocation(verseKey: string, lastReadAt: number) {
  return {
    id: 'reading-location',
    ownerScope: 'qf:account-a' as const,
    verseKey,
    surahNumber: Number(verseKey.split(':')[0]),
    ayahNumber: Number(verseKey.split(':')[1]),
    lastReadAt,
    createdAt: lastReadAt,
    updatedAt: lastReadAt,
  };
}

it('applies the canonical post-merge reading winner instead of a stale remote mutation', async () => {
  let cachedPage = 8;
  const database = {
    getLatestReadingLocation: jest.fn(async () =>
      readingLocation('18:10', 2_000),
    ),
  };
  const service = new MushafSyncedReadingService({
    database,
    resolveVersePage: async verseKey => (verseKey === '18:10' ? 293 : null),
    getLastReadPageUpdatedAt: () => 2_000,
    setLastReadPageFromSync: (_accountId, page) => {
      cachedPage = page;
    },
  });

  await service.applyCanonicalForAccount('account-a');

  expect(cachedPage).toBe(293);
});

it('leaves the prior cache intact and completes when the canonical verse cannot be resolved', async () => {
  let cachedPage = 8;
  const service = new MushafSyncedReadingService({
    database: {
      getLatestReadingLocation: async () => readingLocation('999:1', 2_000),
    },
    resolveVersePage: async () => null,
    getLastReadPageUpdatedAt: () => null,
    setLastReadPageFromSync: (_accountId, page) => {
      cachedPage = page;
    },
  });

  await expect(service.applyCanonicalForAccount('account-a')).resolves.toBe(
    false,
  );
  expect(cachedPage).toBe(8);
});

it('does not clobber the cache or fail sync when verse resolution throws', async () => {
  let cachedPage = 8;
  const service = new MushafSyncedReadingService({
    database: {
      getLatestReadingLocation: async () => readingLocation('18:10', 2_000),
    },
    resolveVersePage: async () => {
      throw new Error('mushaf data unavailable');
    },
    getLastReadPageUpdatedAt: () => null,
    setLastReadPageFromSync: (_accountId, page) => {
      cachedPage = page;
    },
  });

  await expect(service.applyCanonicalForAccount('account-a')).resolves.toBe(
    false,
  );
  expect(cachedPage).toBe(8);
});

it('does not apply a pulled page when newer local reading intent arrives during resolution', async () => {
  let cachedPage = 8;
  let localIntentRevision = 3;
  let finishResolution: (page: number | null) => void = () => undefined;
  const service = new MushafSyncedReadingService({
    database: {
      getLatestReadingLocation: async () => readingLocation('18:10', 2_000),
    },
    resolveVersePage: () =>
      new Promise(resolve => {
        finishResolution = resolve;
      }),
    getLocalIntentRevision: () => localIntentRevision,
    getLastReadPageUpdatedAt: () => null,
    setLastReadPageFromSync: (_accountId, page) => {
      cachedPage = page;
    },
  });

  const applying = service.applyCanonicalForAccount('account-a', 3);
  await Promise.resolve();
  localIntentRevision = 4;
  finishResolution(293);

  await expect(applying).resolves.toBe(false);
  expect(cachedPage).toBe(8);
});
