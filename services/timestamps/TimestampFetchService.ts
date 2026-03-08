import {RECITERS, type Rewayat} from '@/data/reciterData';
import {timestampDatabaseService} from './TimestampDatabaseService';
import type {
  AyahTimestamp,
  Mp3QuranAyahTiming,
  QdcAudioFileResponse,
  TimestampSource,
} from '@/types/timestamps';

const MP3QURAN_BASE = 'https://mp3quran.net/api/v3/ayat_timing';
const QDC_BASE = 'https://api.qurancdn.com/api/qdc/audio/reciters';

class TimestampFetchService {
  /**
   * Get the timestamp source info for a rewayat.
   * Returns null if the rewayat has no timestamp mapping.
   */
  getSourceForRewayat(rewayatId: string): {
    source: TimestampSource;
    apiId: number;
  } | null {
    const rewayat = this.findRewayat(rewayatId);
    if (!rewayat) return null;

    if (rewayat.mp3quran_read_id) {
      return {source: 'mp3quran', apiId: rewayat.mp3quran_read_id};
    }
    if (rewayat.qdc_reciter_id) {
      return {source: 'qdc', apiId: rewayat.qdc_reciter_id};
    }
    return null;
  }

  /**
   * Fetch timestamps for a surah from the appropriate API.
   * Returns normalized AyahTimestamp[] or null if fetch fails.
   */
  async fetchAndCache(
    rewayatId: string,
    surahNumber: number,
  ): Promise<AyahTimestamp[] | null> {
    const sourceInfo = this.getSourceForRewayat(rewayatId);
    if (!sourceInfo) return null;

    try {
      let timestamps: AyahTimestamp[];

      if (sourceInfo.source === 'mp3quran') {
        timestamps = await this.fetchFromMp3Quran(
          sourceInfo.apiId,
          surahNumber,
        );
      } else {
        timestamps = await this.fetchFromQdc(sourceInfo.apiId, surahNumber);
      }

      if (timestamps.length === 0) return null;

      // Write to SQLite cache
      await timestampDatabaseService.writeTimestamps(
        rewayatId,
        surahNumber,
        timestamps,
        sourceInfo.source,
      );

      return timestamps;
    } catch (error) {
      console.warn(
        `[TimestampFetch] Failed to fetch timestamps for ${rewayatId} surah ${surahNumber}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Fetch from MP3Quran API and normalize to AyahTimestamp[].
   * API: GET /api/v3/ayat_timing?surah={N}&read={readId}
   * Returns a bare array with times in milliseconds.
   */
  private async fetchFromMp3Quran(
    readId: number,
    surahNumber: number,
  ): Promise<AyahTimestamp[]> {
    const url = `${MP3QURAN_BASE}?surah=${surahNumber}&read=${readId}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`MP3Quran API error: ${response.status}`);
    }

    const data: Mp3QuranAyahTiming[] = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    return data.map(t => ({
      surahNumber,
      ayahNumber: t.ayah,
      timestampFrom: t.start_time,
      timestampTo: t.end_time,
      durationMs: t.end_time - t.start_time,
    }));
  }

  /**
   * Fetch from QDC API and normalize to AyahTimestamp[].
   * API: GET /api/qdc/audio/reciters/{id}/audio_files?chapter={N}&segments=true
   * Returns times already in milliseconds.
   */
  private async fetchFromQdc(
    reciterId: number,
    surahNumber: number,
  ): Promise<AyahTimestamp[]> {
    const url = `${QDC_BASE}/${reciterId}/audio_files?chapter=${surahNumber}&segments=true`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`QDC API error: ${response.status}`);
    }

    const data: QdcAudioFileResponse = await response.json();

    if (
      !data.audio_files ||
      data.audio_files.length === 0 ||
      !data.audio_files[0].verse_timings
    ) {
      return [];
    }

    return data.audio_files[0].verse_timings.map(t => {
      const ayahNumber = parseInt(t.verse_key.split(':')[1], 10);
      return {
        surahNumber,
        ayahNumber,
        timestampFrom: t.timestamp_from,
        timestampTo: t.timestamp_to,
        durationMs: t.timestamp_to - t.timestamp_from,
      };
    });
  }

  private findRewayat(rewayatId: string): Rewayat | undefined {
    for (const reciter of RECITERS) {
      const rw = reciter.rewayat.find(r => r.id === rewayatId);
      if (rw) return rw;
    }
    return undefined;
  }
}

export const timestampFetchService = new TimestampFetchService();
