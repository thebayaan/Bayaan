import type {QfReadingLocation} from '@/services/sync/qfSyncDatabaseService';

interface CanonicalReadingDatabase {
  getLatestReadingLocation(
    accountId: string,
  ): Promise<QfReadingLocation | null>;
}

interface MushafSyncedReadingServiceOptions {
  database?: CanonicalReadingDatabase;
  resolveVersePage?: (verseKey: string) => Promise<number | null>;
  getLocalIntentRevision?: (accountId: string) => number;
  getLastReadPageUpdatedAt?: (accountId: string) => number | null;
  setLastReadPageFromSync?: (
    accountId: string,
    page: number,
    updatedAt: number,
  ) => void;
}

async function resolveVersePage(verseKey: string): Promise<number | null> {
  const {digitalKhattDataService} =
    require('./DigitalKhattDataService') as typeof import('./DigitalKhattDataService');
  await digitalKhattDataService.initialize();
  const page = digitalKhattDataService.getPageForVerse(verseKey);
  return typeof page === 'number' &&
    Number.isSafeInteger(page) &&
    page >= 1 &&
    page <= 604
    ? page
    : null;
}

export class MushafSyncedReadingService {
  private readonly database: CanonicalReadingDatabase;
  private readonly resolveVersePage: (
    verseKey: string,
  ) => Promise<number | null>;
  private readonly setLastReadPageFromSync: (
    accountId: string,
    page: number,
    updatedAt: number,
  ) => void;
  private readonly getLocalIntentRevision: (accountId: string) => number;
  private readonly getLastReadPageUpdatedAt: (
    accountId: string,
  ) => number | null;

  constructor(options: MushafSyncedReadingServiceOptions = {}) {
    this.database =
      options.database ??
      require('@/services/sync/qfSyncDatabaseService').qfSyncDatabaseService;
    this.resolveVersePage = options.resolveVersePage ?? resolveVersePage;
    this.getLocalIntentRevision =
      options.getLocalIntentRevision ??
      (accountId =>
        require('@/services/sync/qfReadingSessionService').qfReadingSessionService.getIntentRevision(
          accountId,
        ));
    this.getLastReadPageUpdatedAt =
      options.getLastReadPageUpdatedAt ??
      (accountId =>
        require('./MushafSessionStore').mushafSessionStore.getLastReadPageUpdatedAt(
          accountId,
        ));
    this.setLastReadPageFromSync =
      options.setLastReadPageFromSync ??
      ((accountId, page, updatedAt) =>
        require('./MushafSessionStore').mushafSessionStore.setLastReadPageFromSync(
          accountId,
          page,
          updatedAt,
        ));
  }

  async applyCanonicalForAccount(
    accountId: string,
    expectedLocalIntentRevision?: number,
  ): Promise<boolean> {
    try {
      if (
        expectedLocalIntentRevision !== undefined &&
        this.getLocalIntentRevision(accountId) !== expectedLocalIntentRevision
      ) {
        return false;
      }
      const location = await this.database.getLatestReadingLocation(accountId);
      if (!location) return false;
      if (
        (this.getLastReadPageUpdatedAt(accountId) ?? 0) > location.lastReadAt
      ) {
        return false;
      }
      const page = await this.resolveVersePage(location.verseKey);
      if (page === null) return false;
      if (
        expectedLocalIntentRevision !== undefined &&
        this.getLocalIntentRevision(accountId) !== expectedLocalIntentRevision
      ) {
        return false;
      }
      if (
        (this.getLastReadPageUpdatedAt(accountId) ?? 0) > location.lastReadAt
      ) {
        return false;
      }
      this.setLastReadPageFromSync(accountId, page, location.lastReadAt);
      return true;
    } catch {
      return false;
    }
  }
}

export const mushafSyncedReadingService = new MushafSyncedReadingService();
