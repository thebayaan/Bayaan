import surahData from '@/data/surahData.json';
import {qfSyncDatabaseService} from '@/services/sync/qfSyncDatabaseService';
import {useQfSyncStore} from '@/store/qfSyncStore';

export const READING_SESSION_DEBOUNCE_MS = 1000;

interface ReadingLocationDatabase {
  upsertReadingLocation(input: {
    accountId: string;
    verseKey: string;
    surahNumber: number;
    ayahNumber: number;
    lastReadAt: number;
  }): Promise<void>;
}

interface QfReadingSessionServiceOptions {
  database?: ReadingLocationDatabase;
  now?: () => number;
  getActiveAccountId?: () => string | null;
  requestSync?: () => void;
  debounceMs?: number;
}

interface PendingReadingLocation {
  accountId: string;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  lastReadAt: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const VERSE_COUNTS = new Map<number, number>(
  surahData.map(surah => [surah.id, surah.verses_count]),
);

function parseVerseKey(verseKey: string): {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
} | null {
  const match = /^(\d+):(\d+)$/.exec(verseKey);
  if (!match) return null;
  const surahNumber = Number(match[1]);
  const ayahNumber = Number(match[2]);
  const verseCount = VERSE_COUNTS.get(surahNumber);
  if (!verseCount || ayahNumber < 1 || ayahNumber > verseCount) return null;
  return {
    verseKey: `${surahNumber}:${ayahNumber}`,
    surahNumber,
    ayahNumber,
  };
}

export class QfReadingSessionService {
  private readonly database: ReadingLocationDatabase;
  private readonly now: () => number;
  private readonly getActiveAccountId: () => string | null;
  private readonly requestSync: () => void;
  private readonly debounceMs: number;
  private readonly pending = new Map<string, PendingReadingLocation>();
  private readonly flushTails = new Map<string, Promise<void>>();

  constructor(options: QfReadingSessionServiceOptions = {}) {
    this.database = options.database ?? qfSyncDatabaseService;
    this.now = options.now ?? Date.now;
    this.getActiveAccountId =
      options.getActiveAccountId ??
      (() => useQfSyncStore.getState().activeAccountId);
    this.requestSync =
      options.requestSync ?? (() => useQfSyncStore.getState().requestSync());
    this.debounceMs = options.debounceMs ?? READING_SESSION_DEBOUNCE_MS;
  }

  recordVisibleVerse(verseKey: string): void {
    const accountId = this.getActiveAccountId();
    if (!accountId) return;
    const parsed = parseVerseKey(verseKey);
    if (!parsed) return;

    const previous = this.pending.get(accountId);
    if (previous?.timer) clearTimeout(previous.timer);
    const next: PendingReadingLocation = {
      accountId,
      ...parsed,
      lastReadAt: this.now(),
      timer: null,
    };
    next.timer = setTimeout(() => {
      this.flush(accountId).catch(() => undefined);
    }, this.debounceMs);
    this.pending.set(accountId, next);
  }

  async flush(accountId?: string): Promise<void> {
    const accountIds = accountId ? [accountId] : [...this.pending.keys()];
    await Promise.all(accountIds.map(id => this.flushAccount(id)));
  }

  private async flushAccount(accountId: string): Promise<void> {
    const previous = this.flushTails.get(accountId) ?? Promise.resolve();
    const current = previous.then(async () => {
      const entry = this.pending.get(accountId);
      if (!entry) return;
      if (entry.timer) clearTimeout(entry.timer);
      this.pending.delete(accountId);
      try {
        await this.database.upsertReadingLocation({
          accountId: entry.accountId,
          verseKey: entry.verseKey,
          surahNumber: entry.surahNumber,
          ayahNumber: entry.ayahNumber,
          lastReadAt: entry.lastReadAt,
        });
        this.requestSync();
      } catch (error) {
        if (!this.pending.has(accountId)) {
          const retry: PendingReadingLocation = {...entry, timer: null};
          retry.timer = setTimeout(() => {
            this.flush(accountId).catch(() => undefined);
          }, this.debounceMs);
          this.pending.set(accountId, retry);
        }
        throw error;
      }
    });
    this.flushTails.set(accountId, current);
    try {
      await current;
    } finally {
      if (this.flushTails.get(accountId) === current) {
        this.flushTails.delete(accountId);
      }
    }
  }
}

export const qfReadingSessionService = new QfReadingSessionService();
