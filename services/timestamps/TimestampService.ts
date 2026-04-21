import {timestampDatabaseService} from './TimestampDatabaseService';
import {timestampFetchService} from './TimestampFetchService';
import type {AyahTimestamp} from '@/types/timestamps';

class TimestampService {
  private cache = new Map<string, AyahTimestamp[]>();

  async initialize(): Promise<void> {
    await timestampDatabaseService.initialize();
  }

  /**
   * Check if a rewayat has timestamp support (static check, no network).
   */
  hasTimestampSource(rewayatId: string): boolean {
    return timestampFetchService.getSourceForRewayat(rewayatId) !== null;
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
