// Base track type compatible with expo-audio
export interface Track {
  id: string;
  url: string;
  title: string;
  artist: string;
  artwork?: string;
  duration?: number;
  reciterId: string;
  reciterName: string;
  surahId?: string;
  rewayatId?: string;
  isUserUpload?: boolean;
  userRecitationId?: string;
  /** Category label for non-surah uploads (dua, lecture, tafsir, other) */
  uploadCategory?: string;
  /** Rewayah display name carried from upload tags (fallback when rewayatId isn't resolved) */
  rewayahName?: string;
}

// Helper type for track conversion
export type TrackWithOptionalFields = Partial<Track>;

// Helper function to safely convert library track to our track type
export function ensureTrackFields(track: TrackWithOptionalFields): Track {
  return {
    // Required fields
    id: track.id || '',
    url: track.url || '',
    title: track.title || '',
    artist: track.artist || '',

    // Optional fields
    artwork: track.artwork || '',
    duration: track.duration,

    // Our required fields
    reciterId: track.reciterId || '',
    reciterName: track.reciterName || '',

    // Our optional fields
    surahId: track.surahId,
    rewayatId: track.rewayatId,
    isUserUpload: track.isUserUpload,
    userRecitationId: track.userRecitationId,
    uploadCategory: track.uploadCategory,
    rewayahName: track.rewayahName,
  };
}
