export interface Track extends Omit<TrackPlayerTrack, 'reciterId'> {
  reciterId: string;
}

export interface TrackPlayerTrack {
  id: string;
  url: string;
  title: string;
  artist: string;
  reciterId: string;
  artwork?: string;
  duration?: number;
}

export function toTrackPlayerTrack(track: Track): TrackPlayerTrack {
  return {
    id: track.id,
    url: track.url,
    title: track.title || '',
    artist: track.artist || '',
    reciterId: track.reciterId,
    artwork: track.artwork ?? undefined,
  };
}
