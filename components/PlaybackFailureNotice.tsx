// @ai-generated
import {useEffect} from 'react';
import i18n from '@/i18n';
import {showToast} from '@/utils/toastUtils';
import {onPlaybackFailed} from '@/services/player/utils/playbackFailure';

// One notice per burst: a failed skip is often followed by another.
const NOTICE_GAP_MS = 4000;

/**
 * Tells the user when a recitation could not be loaded or played. Before
 * this, a failed load was silent: no sound and no message. Renders nothing;
 * mounted once at the root, beside NetworkStatusMonitor.
 */
export function PlaybackFailureNotice(): null {
  useEffect(() => {
    let lastNoticeAt = 0;
    return onPlaybackFailed(() => {
      const now = Date.now();
      if (now - lastNoticeAt < NOTICE_GAP_MS) return;
      lastNoticeAt = now;
      showToast(
        i18n.t('player:playback.failedTitle'),
        i18n.t('player:playback.failedHint'),
        'error',
      );
    });
  }, []);

  return null;
}
