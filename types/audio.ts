import type {Track as RNTrackPlayerTrack} from 'react-native-track-player';

// Our base track type that extends the library's track type
export interface Track extends RNTrackPlayerTrack {
  reciterId: string;
  reciterName: string;
  surahId?: string;
  rewayatId?: string;
  isUserUpload?: boolean;
  userRecitationId?: string;
  rewayahName?: string;
  styleName?: string;
}

// Helper type for track conversion
export type TrackWithOptionalFields = Partial<Track>;

// Helper function to safely convert library track to our track type
export function ensureTrackFields(track: TrackWithOptionalFields): Track {
  return {
    // Required fields from RNTrackPlayerTrack with defaults
    url: track.url || '',
    title: track.title || '',
    artist: track.artist || '',
    id: track.id || '',

    // Optional fields from RNTrackPlayerTrack
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
    rewayahName: track.rewayahName,
    styleName: track.styleName,
  };
}
