import {timestampDatabaseService} from './TimestampDatabaseService';
import {timestampFetchService} from './TimestampFetchService';
import type {AyahTimestamp, TimestampLoadResult} from '@/types/timestamps';

class TimestampService {
  private cache = new Map<string, AyahTimestamp[]>();

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
   * Get timestamps for a surah, or null when there are none to be had, for
   * callers that treat every reason alike. See loadForSurah. @ai
   */
  async getTimestampsForSurah(
    rewayatId: string,
    surahNumber: number,
  ): Promise<AyahTimestamp[] | null> {
    const result = await this.loadForSurah(rewayatId, surahNumber);
    return result.status === 'ok' ? result.timestamps : null;
  }

  /**
   * Timestamps for a surah, or why there are none. Checks:
   * 1. In-memory cache (instant)
   * 2. SQLite cache (fast, ~1ms)
   * 3. API fetch + cache (network, ~200ms)
   * Never rejects. @ai
   */
  async loadForSurah(
    rewayatId: string,
    surahNumber: number,
  ): Promise<TimestampLoadResult> {
    const key = `${rewayatId}-${surahNumber}`;

    // 1. In-memory cache
    const cached = this.cache.get(key);
    if (cached) return {status: 'ok', timestamps: cached};

    // 2. SQLite cache. A failed read only costs the cache: the network may
    // still have the timings.
    try {
      const dbTimestamps = await timestampDatabaseService.getTimestampsForSurah(
        rewayatId,
        surahNumber,
      );
      if (dbTimestamps.length > 0) {
        this.cache.set(key, dbTimestamps);
        return {status: 'ok', timestamps: dbTimestamps};
      }
    } catch (error) {
      console.warn('[TimestampService] Cache read failed:', error);
    }

    // 3. Fetch from API and cache
    try {
      const fetched = await timestampFetchService.fetchAndCache(
        rewayatId,
        surahNumber,
      );
      if (fetched.status === 'ok') this.cache.set(key, fetched.timestamps);
      return fetched;
    } catch (error) {
      console.warn('[TimestampService] Fetch failed:', error);
      return {status: 'failed', reason: 'offline'};
    }
  }
}

export const timestampService = new TimestampService();
