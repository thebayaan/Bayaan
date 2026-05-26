/**
 * Native playback state union, used by audio services to communicate with consumers.
 *
 * - `idle` — no track loaded
 * - `loading` — load in progress
 * - `ready` — track loaded, not playing
 * - `playing` — actively playing
 * - `paused` — track loaded, paused (distinct from idle/ready)
 * - `error` — last operation failed; consumer should inspect onError
 */
export type PlaybackState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'error';

/**
 * Minimum fields every track must have. Consumer apps extend this with their
 * own metadata shape (surah / reciter / rewayah / album / chapter / etc.).
 *
 * Future audio package will expose `Track<TMeta extends BaseTrack>` so consumer
 * metadata stays consumer-typed without leaking into the package.
 */
export interface BaseTrack {
  id: string;
  url: string;
  title: string;
  artist?: string;
  artworkUrl?: string;
  durationMs?: number;
}
