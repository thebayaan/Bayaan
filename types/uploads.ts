// Domain types (camelCase)

export type RecordingType = 'studio' | 'salah' | null;

export interface UploadedRecitation {
  id: string;
  filePath: string; // relative filename only (e.g., '{uuid}.mp3')
  originalFilename: string;
  duration: number | null;
  dateAdded: number;

  // Tagging (all nullable for untagged state)
  type: 'surah' | 'other' | null;
  surahNumber: number | null;
  startVerse: number | null; // null = full surah
  endVerse: number | null; // null = full surah
  title: string | null; // for 'other' type
  category: 'dua' | 'lecture' | 'tafsir' | 'other' | null;
  reciterId: string | null; // FK to system reciters
  customReciterId: string | null; // FK to custom_reciters
  isPersonal: boolean; // reserved for v2
  rewayah: string | null;
  style: string | null;
  recordingType: RecordingType; // studio vs salah recordings
}

export interface CustomReciter {
  id: string;
  name: string;
  imageUri: string | null;
  createdAt: number;
}

// Row types (snake_case — maps directly to SQLite columns)

export interface UploadedRecitationRow {
  id: string;
  file_path: string;
  original_filename: string;
  duration: number | null;
  date_added: number;
  type: string | null;
  surah_number: number | null;
  start_verse: number | null;
  end_verse: number | null;
  title: string | null;
  category: string | null;
  reciter_id: string | null;
  custom_reciter_id: string | null;
  is_personal: number;
  rewayah: string | null;
  style: string | null;
  recording_type: string | null;
}

export interface CustomReciterRow {
  id: string;
  name: string;
  image_uri: string | null;
  created_at: number;
}

// Mapping helpers

export function mapRecitationRow(
  row: UploadedRecitationRow,
): UploadedRecitation {
  return {
    id: row.id,
    filePath: row.file_path,
    originalFilename: row.original_filename,
    duration: row.duration,
    dateAdded: row.date_added,
    type: row.type as UploadedRecitation['type'],
    surahNumber: row.surah_number,
    startVerse: row.start_verse,
    endVerse: row.end_verse,
    title: row.title,
    category: row.category as UploadedRecitation['category'],
    reciterId: row.reciter_id,
    customReciterId: row.custom_reciter_id,
    isPersonal: row.is_personal === 1,
    rewayah: row.rewayah,
    style: row.style,
    recordingType: row.recording_type as RecordingType,
  };
}

export function mapCustomReciterRow(row: CustomReciterRow): CustomReciter {
  return {
    id: row.id,
    name: row.name,
    imageUri: row.image_uri,
    createdAt: row.created_at,
  };
}
