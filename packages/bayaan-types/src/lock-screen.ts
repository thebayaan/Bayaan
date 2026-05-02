/**
 * Metadata payload for OS lock-screen / Now Playing controls.
 *
 * Consumer apps build this from their playback state and the active track;
 * future audio package's lock-screen integration consumes it.
 */
export interface LockScreenMetadata {
  title: string;
  artist: string;
  artworkUrl?: string;
  durationMs: number;
  positionMs: number;
  isPlaying: boolean;
}
