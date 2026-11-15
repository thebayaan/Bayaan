import {timestampDatabaseService} from './TimestampDatabaseService';
// @ai-start
import {
  TIMESTAMP_DATA_VERSION,
  timestampFetchService,
} from './TimestampFetchService';
// @ai-end
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
      // @ai-start
      // 2. SQLite cache. Opened here if it could not be at launch: every
      // lookup used to fail then, with no download either, so no surah had
      // verse tracking until the app was restarted. If it still cannot be
      // read, the timings are downloaded (and played without being kept).
      let dbTimestamps: AyahTimestamp[] = [];
      let stale = false;
      try {
        await timestampDatabaseService.initialize();
        dbTimestamps = await timestampDatabaseService.getTimestampsForSurah(
          rewayatId,
          surahNumber,
        );

        // Timings cached before TIMESTAMP_DATA_VERSION was bumped (they were
        // regenerated) are fetched again; they are only used while the new
        // ones cannot be fetched (offline), and not kept in memory so a later
        // load tries again.
        stale =
          dbTimestamps.length > 0 &&
          (await timestampDatabaseService.getCachedDataVersion(
            rewayatId,
            surahNumber,
          )) !== TIMESTAMP_DATA_VERSION;
      } catch (error) {
        console.warn('[Timestamps] Cache unavailable, downloading:', error);
      }
      // @ai-end

      // @ai Only timings saved at the current data version are final.
      if (dbTimestamps.length > 0 && !stale) {
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

      return stale ? dbTimestamps : null; // @ai
    } catch {
      return null;
    }
  }
}

export const timestampService = new TimestampService();
