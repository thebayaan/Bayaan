// Domain types (camelCase)

export interface AyahTimestamp {
  surahNumber: number;
  ayahNumber: number;
  timestampFrom: number; // milliseconds
  timestampTo: number; // milliseconds
  durationMs: number;
}

export interface TimestampMeta {
  rewayatId: string;
  slug: string;
  source: string; // 'qurancom'
  audioSource: string; // 'quranicaudio' | etc.
  version: number;
  totalAyahs: number;
  hasWordSegments: boolean;
  audioUrlPattern: string | null;
  urlPadding: string; // 'padded' | 'unpadded'
}

export interface AyahTrackingState {
  surahNumber: number;
  ayahNumber: number;
  verseKey: string; // "2:255" format
  timestampFrom: number;
  timestampTo: number;
}

// Row types (snake_case — direct SQLite column mapping)

export interface TimestampMetaRow {
  rewayat_id: string;
  slug: string;
  source: string;
  audio_source: string;
  version: number;
  total_ayahs: number;
  has_word_segments: number; // 0 or 1
  audio_url_pattern: string | null;
  url_padding: string;
}

export interface AyahTimestampRow {
  rewayat_id: string;
  surah_number: number;
  ayah_number: number;
  timestamp_from: number;
  timestamp_to: number;
  duration_ms: number;
}

// Mapping functions

export function mapTimestampMetaRow(row: TimestampMetaRow): TimestampMeta {
  return {
    rewayatId: row.rewayat_id,
    slug: row.slug,
    source: row.source,
    audioSource: row.audio_source,
    version: row.version,
    totalAyahs: row.total_ayahs,
    hasWordSegments: row.has_word_segments === 1,
    audioUrlPattern: row.audio_url_pattern,
    urlPadding: row.url_padding,
  };
}

export function mapAyahTimestampRow(row: AyahTimestampRow): AyahTimestamp {
  return {
    surahNumber: row.surah_number,
    ayahNumber: row.ayah_number,
    timestampFrom: row.timestamp_from,
    timestampTo: row.timestamp_to,
    durationMs: row.duration_ms,
  };
}
