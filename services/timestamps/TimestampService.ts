import {timestampDatabaseService} from './TimestampDatabaseService';
import type {AyahTimestamp, TimestampMeta} from '@/types/timestamps';

class TimestampService {
  private cache = new Map<string, AyahTimestamp[]>();

  async initialize(): Promise<void> {
    await timestampDatabaseService.initialize();
  }

  async getTimestampsForSurah(
    rewayatId: string,
    surahNumber: number,
  ): Promise<AyahTimestamp[] | null> {
    const key = `${rewayatId}-${surahNumber}`;

    const cached = this.cache.get(key);
    if (cached) return cached;

    try {
      const timestamps = await timestampDatabaseService.getTimestampsForSurah(
        rewayatId,
        surahNumber,
      );

      if (timestamps.length === 0) return null;

      this.cache.set(key, timestamps);
      return timestamps;
    } catch {
      return null;
    }
  }

  async hasTimestamps(rewayatId: string): Promise<boolean> {
    try {
      return await timestampDatabaseService.hasTimestamps(rewayatId);
    } catch {
      return false;
    }
  }

  async getMeta(rewayatId: string): Promise<TimestampMeta | null> {
    try {
      return await timestampDatabaseService.getMeta(rewayatId);
    } catch {
      return null;
    }
  }
}

export const timestampService = new TimestampService();
