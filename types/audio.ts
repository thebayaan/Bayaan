import type {Track as RNTrackPlayerTrack} from 'react-native-track-player';
import type {DownloadStatus} from '@/services/download/types';

// Our base track type that extends the library's track type
export interface Track extends RNTrackPlayerTrack {
  reciterId: string;
  reciterName: string;
  surahId?: string;
  rewayatId?: string;
}

// Extended track interface with download properties
export interface DownloadableTrack extends Track {
  isDownloaded: boolean;
  downloadStatus: DownloadStatus;
  downloadProgress?: number;
  localPath?: string;
  downloadDate?: Date;
  fileSize?: number;
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
  };
}
