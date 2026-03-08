// Domain types (camelCase)

export interface AyahTimestamp {
  surahNumber: number;
  ayahNumber: number;
  timestampFrom: number; // milliseconds
  timestampTo: number; // milliseconds
  durationMs: number;
}

export interface AyahTrackingState {
  surahNumber: number;
  ayahNumber: number;
  verseKey: string; // "2:255" format
  timestampFrom: number;
  timestampTo: number;
}

// Row types (snake_case — direct SQLite column mapping)

export interface AyahTimestampRow {
  rewayat_id: string;
  surah_number: number;
  ayah_number: number;
  timestamp_from: number;
  timestamp_to: number;
  duration_ms: number;
}

// Mapping functions

export function mapAyahTimestampRow(row: AyahTimestampRow): AyahTimestamp {
  return {
    surahNumber: row.surah_number,
    ayahNumber: row.ayah_number,
    timestampFrom: row.timestamp_from,
    timestampTo: row.timestamp_to,
    durationMs: row.duration_ms,
  };
}

// --- API Response Types ---

export type TimestampSource = 'mp3quran' | 'qdc' | 'local';

/** MP3Quran /api/v3/ayat_timing response shape */
export interface Mp3QuranTimingResponse {
  ayat_timing: Mp3QuranAyahTiming[];
}

export interface Mp3QuranAyahTiming {
  ayah: number;
  start_time: number; // seconds (float)
  end_time: number; // seconds (float)
}

/** QDC /api/qdc/audio/reciters/{id}/audio_files response shape */
export interface QdcAudioFileResponse {
  audio_files: QdcAudioFile[];
}

export interface QdcAudioFile {
  verse_timings: QdcVerseTiming[];
}

export interface QdcVerseTiming {
  verse_key: string; // "2:255"
  timestamp_from: number; // milliseconds
  timestamp_to: number; // milliseconds
  segments: number[][]; // word-level segments (ignored for now)
}
