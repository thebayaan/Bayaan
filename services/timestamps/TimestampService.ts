import {timestampDatabaseService} from './TimestampDatabaseService';
import {timestampFetchService} from './TimestampFetchService';
import type {AyahTimestamp} from '@/types/timestamps';

class TimestampService {
  private cache = new Map<string, AyahTimestamp[]>();
  // @ai-start
  // Loads going on, by key. A surah asked for again before its first load
  // settled (the player and the numbering check ask for the same ones) waits
  // for that load instead of downloading and saving it a second time.
  private inFlight = new Map<string, Promise<AyahTimestamp[] | null>>();
  // @ai-end

  async initialize(): Promise<void> {
    await timestampDatabaseService.initialize();
  }

  /**
   * Check if a rewayat has timestamp support (static check, no network).
   */
  hasTimestampSource(rewayatId: string): boolean {
    return timestampFetchService.hasSource(rewayatId);
  }

  /**
   * Get timestamps for a surah. Checks:
   * 1. In-memory cache (instant)
   * 2. SQLite cache (fast, ~1ms)
   * 3. API fetch + cache (network, ~200ms)
   */
  async getTimestampsForSurah(
    rewayatId: string,
    surahNumber: number,
  ): Promise<AyahTimestamp[] | null> {
    const key = `${rewayatId}-${surahNumber}`;

    // 1. In-memory cache
    const cached = this.cache.get(key);
    if (cached) return cached;

    // @ai-start
    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const load = this.loadTimestamps(key, rewayatId, surahNumber).finally(
      () => {
        if (this.inFlight.get(key) === load) this.inFlight.delete(key);
      },
    );
    this.inFlight.set(key, load);
    return load;
  }

  private async loadTimestamps(
    key: string,
    rewayatId: string,
    surahNumber: number,
  ): Promise<AyahTimestamp[] | null> {
    // @ai-end
    try {
      // 2. SQLite cache
      const dbTimestamps = await timestampDatabaseService.getTimestampsForSurah(
        rewayatId,
        surahNumber,
      );

      if (dbTimestamps.length > 0) {
        this.cache.set(key, dbTimestamps);
        return dbTimestamps;
      }

      // 3. Fetch from API and cache
      const fetched = await timestampFetchService.fetchAndCache(
        rewayatId,
        surahNumber,
      );

      if (fetched) {
        this.cache.set(key, fetched);
        return fetched;
      }

      return null;
    } catch {
      return null;
    }
  }
}

export const timestampService = new TimestampService();
