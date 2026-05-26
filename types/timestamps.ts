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

export type TimestampSource = 'r2' | 'local';
