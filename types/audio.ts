export interface Track {
  id: string;
  url: string;
  title: string;
  artist: string;
  reciterId: string;
}

// This interface represents the track structure expected by react-native-track-player
export interface TrackPlayerTrack {
  id: string;
  url: string;
  title: string;
  artist: string;
  reciterId: string; // Add this line
  // Add any other fields that TrackPlayer expects
}

// Utility function to convert our Track to TrackPlayerTrack
export function toTrackPlayerTrack(track: Track): TrackPlayerTrack {
  return {
    id: track.id,
    url: track.url,
    title: track.title,
    artist: track.artist,
    reciterId: track.reciterId, // Add this line
    // Map any other fields as needed
  };
}
