// @ai-generated
import i18n from '@/i18n';
import {
  RANGE_UNPLAYABLE_ERROR,
  TIMESTAMPS_UNAVAILABLE_ERROR,
  VERSE_TIMING_UNAVAILABLE_ERROR,
  type PlaybackNoticeText,
} from '@/store/mushafPlayerStore';

/** Translate known presentation errors without changing the playback state. */
export function playbackErrorText(message: string): string {
  switch (message) {
    case RANGE_UNPLAYABLE_ERROR:
      return i18n.t('reader:playback.rangeUnplayable');
    case TIMESTAMPS_UNAVAILABLE_ERROR:
      return i18n.t('reader:playback.timestampsUnavailable');
    case VERSE_TIMING_UNAVAILABLE_ERROR:
      return i18n.t('reader:playback.verseTimingUnavailable');
    default:
      return message;
  }
}

export function playbackNoticeText(): PlaybackNoticeText {
  return {
    trackingUnavailable: i18n.t('reader:playback.trackingUnavailable'),
    playbackUnavailable: i18n.t('reader:playback.unavailable'),
    untrackedSurah: (name, fromBeginning) =>
      i18n.t(
        fromBeginning
          ? 'reader:playback.fromBeginning'
          : 'reader:playback.untracked',
        {surah: name || i18n.t('reader:playback.surah')},
      ),
    error: playbackErrorText,
  };
}
