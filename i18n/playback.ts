// @ai-generated
import i18n from '@/i18n';
import {
  AUDIO_LOAD_FAILED_ERROR,
  PLAYBACK_START_FAILED_ERROR,
  RANGE_UNPLAYABLE_ERROR,
  RECITER_REMOVED_ERROR,
  TIMINGS_LOAD_FAILED_ERROR,
  TIMESTAMPS_UNAVAILABLE_ERROR,
  VERSE_TIMING_UNAVAILABLE_ERROR,
  type PlaybackNoticeText,
} from '@/store/mushafPlayerStore';

/** Translate known presentation errors without changing the playback state. */
export function playbackErrorText(message: string, surahName = ''): string {
  const surah = surahName || i18n.t('reader:playback.surah');
  switch (message) {
    case RANGE_UNPLAYABLE_ERROR:
      return i18n.t('reader:playback.rangeUnplayable');
    case TIMESTAMPS_UNAVAILABLE_ERROR:
      return i18n.t('reader:playback.timestampsUnavailable', {surah});
    case VERSE_TIMING_UNAVAILABLE_ERROR:
      return i18n.t('reader:playback.verseTimingUnavailable', {surah});
    case TIMINGS_LOAD_FAILED_ERROR:
      return i18n.t('reader:playback.timingsLoadFailed');
    case AUDIO_LOAD_FAILED_ERROR:
      return i18n.t('reader:playback.audioLoadFailed');
    case RECITER_REMOVED_ERROR:
      return i18n.t('reader:playback.reciterRemoved');
    case PLAYBACK_START_FAILED_ERROR:
      return i18n.t('reader:playback.startFailed');
    default:
      return message;
  }
}

export function playbackNoticeText(): PlaybackNoticeText {
  return {
    playbackUnavailable: i18n.t('reader:playback.unavailable'),
    error: playbackErrorText,
  };
}
