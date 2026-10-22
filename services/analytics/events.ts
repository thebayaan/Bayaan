export const ANALYTICS_EVENTS = {
  // Listening
  PLAYBACK_STARTED: 'playback_started',
  PLAYBACK_PAUSED: 'playback_paused',
  PLAYBACK_RESUMED: 'playback_resumed',
  PLAYBACK_COMPLETED: 'playback_completed',
  PLAYBACK_SKIPPED: 'playback_skipped',
  PLAYBACK_SEEKED: 'playback_seeked',
  MEANINGFUL_LISTEN: 'meaningful_listen',
  RATE_CHANGED: 'rate_changed',
  QUEUE_MODIFIED: 'queue_modified',
  // Mushaf
  MUSHAF_PAGE_OPENED: 'mushaf_page_opened',
  MUSHAF_PAGE_READ: 'mushaf_page_read',
  MUSHAF_SESSION_ENDED: 'mushaf_session_ended',
  // Adhkar
  ADHKAR_SESSION_STARTED: 'adhkar_session_started',
  ADHKAR_SESSION_COMPLETED: 'adhkar_session_completed',
  TASBEEH_COMPLETED: 'tasbeeh_completed',
  // Feature usage
  RECITER_SELECTED: 'reciter_selected',
  REWAYAH_CHANGED: 'rewayah_changed',
  DOWNLOAD_STARTED: 'download_started',
  DOWNLOAD_COMPLETED: 'download_completed',
  AMBIENT_TOGGLED: 'ambient_toggled',
  FAVORITE_TOGGLED: 'favorite_toggled',
  PLAYLIST_MODIFIED: 'playlist_modified',
  SHARE_CREATED: 'share_created',
  SEARCH_PERFORMED: 'search_performed',
  TRANSLATION_VIEWED: 'translation_viewed',
  // @ai-start
  // Moments (short clip feed). Clip listening is kept out of
  // MeaningfulListen and the local listening totals on purpose.
  MOMENTS_OPENED: 'moments_opened',
  MOMENT_VIEWED: 'moment_viewed',
  MOMENT_ENDED: 'moment_ended',
  MOMENT_ACTION: 'moment_action',
  MOMENTS_SESSION_ENDED: 'moments_session_ended',
  // @ai-end
  // Lifecycle
  APP_OPENED: 'app_opened',
  APP_BACKGROUNDED: 'app_backgrounded',
} as const;

export interface PlaybackStartedProps {
  surah_id: number;
  reciter_id: string;
  reciter_name: string;
  rewayah_id: string;
  source: 'queue' | 'direct' | 'autoplay' | 'playlist';
  position_ms: number;
}

export interface PlaybackPausedProps {
  surah_id: number;
  reciter_id: string;
  reciter_name: string;
  position_ms: number;
  listened_ms: number;
}

export interface PlaybackResumedProps {
  surah_id: number;
  reciter_id: string;
  reciter_name: string;
  position_ms: number;
}

export interface PlaybackCompletedProps {
  surah_id: number;
  reciter_id: string;
  reciter_name: string;
  duration_ms: number;
  listened_ms: number;
  completion_pct: number;
}

export interface PlaybackSkippedProps {
  surah_id: number;
  reciter_id: string;
  reciter_name: string;
  position_ms: number;
  listened_ms: number;
  direction: 'next' | 'prev';
}

export interface PlaybackSeekedProps {
  surah_id: number;
  from_ms: number;
  to_ms: number;
}

export interface MeaningfulListenProps {
  surah_id: number;
  reciter_id: string;
  reciter_name: string;
  rewayah_id: string;
}

export interface RateChangedProps {
  old_rate: number;
  new_rate: number;
}

export interface QueueModifiedProps {
  action: 'add' | 'remove' | 'reorder';
  surah_id: number;
  queue_length: number;
}

export interface MushafPageOpenedProps {
  page_number: number;
  surah_id: number;
  juz_number: number;
}

export interface MushafPageReadProps {
  page_number: number;
  duration_ms: number;
  surah_id: number;
}

export interface MushafSessionEndedProps {
  pages_opened: number;
  pages_read: number;
  total_duration_ms: number;
}

export interface AdhkarSessionStartedProps {
  category: string;
}

export interface AdhkarSessionCompletedProps {
  category: string;
  duration_ms: number;
  dhikr_count: number;
}

export interface TasbeehCompletedProps {
  category: string;
  count: number;
}

export interface ReciterSelectedProps {
  reciter_id: string;
  reciter_name: string;
}

export interface RewayahChangedProps {
  rewayah_id: string;
  rewayah_name: string;
}

export interface DownloadStartedProps {
  surah_id: number;
  reciter_id: string;
}

export interface DownloadCompletedProps {
  surah_id: number;
  reciter_id: string;
  file_size_bytes: number;
}

export interface AmbientToggledProps {
  sound_type: string;
  enabled: boolean;
}

export interface FavoriteToggledProps {
  surah_id: number;
  reciter_id: string;
  action: 'add' | 'remove';
}

export interface PlaylistModifiedProps {
  action: 'create' | 'add_track' | 'remove_track';
  track_count: number;
}

export interface ShareCreatedProps {
  content_type: 'verse' | 'surah' | 'mushaf' | 'reciter' | 'adhkar';
  surah_id?: number;
}

export interface SearchPerformedProps {
  query: string;
  results_count: number;
}

export interface TranslationViewedProps {
  translation_id: string;
  language: string;
}

// @ai-start
/** Where Moments was opened from. */
export type MomentsEntry = 'preview' | 'tab';

export interface MomentsOpenedProps {
  entry: MomentsEntry;
}

export interface MomentViewedProps {
  /** Stable across sessions: reciter, rewayah and passage. */
  moment_id: string;
  reciter_id: string;
  rewayah_id: string;
  surah: number;
  /** 0-based card position in the session's feed. */
  position: number;
  /** From the card becoming active to the first audio progress past its start. */
  start_latency_ms: number;
  /** True when the reciter had never played in Moments before this session. */
  new_reciter: boolean;
}

export type MomentEndReason = 'completed' | 'swiped' | 'left';

export interface MomentEndedProps {
  moment_id: string;
  reciter_id: string;
  /** Wall-clock time the clip was audibly playing. */
  listened_ms: number;
  reason: MomentEndReason;
}

export type MomentActionType =
  | 'continue'
  | 'like'
  | 'favorite'
  | 'share'
  | 'profile'
  | 'speed';

export interface MomentActionProps {
  moment_id: string;
  action: MomentActionType;
  reciter_id: string;
  new_reciter: boolean;
  /** For like and favorite: whether the toggle turned it on. */
  enabled?: boolean;
}

export interface MomentsSessionEndedProps {
  cards_seen: number;
  duration_ms: number;
  /**
   * Distinct reciters new to Moments that got a Continue or a Favorite
   * (turned on) this session.
   */
  conversions: number;
  /** Distinct reciters new to Moments that were shown this session. */
  new_reciters_seen: number;
}
// @ai-end

export interface AppBackgroundedProps {
  session_duration_ms: number;
  total_listen_ms: number;
}
