// @ai-generated
import i18n from '@/i18n';
import {getSurahDisplayName} from '@/i18n/format';
import {downloadFailureReason} from '@/services/downloadService';
import {useNetworkStore} from '@/store/networkStore';
import {showToast} from '@/utils/toastUtils';

/**
 * Tells the user a surah did not download. Before this a failed download was
 * silent: the progress ring vanished and the row went back to "Download".
 * A download the user stopped needs no notice.
 */
export function showDownloadFailedToast(
  surah: {name: string; name_arabic: string},
  error: unknown,
): void {
  const reason = downloadFailureReason(error);
  if (reason === 'cancelled') return;
  const offline = reason === 'offline' || !useNetworkStore.getState().isOnline;
  showToast(
    i18n.t('sheets:options.downloadFailedTitle', {
      surah: getSurahDisplayName(surah),
    }),
    offline
      ? i18n.t('sheets:options.downloadOfflineHint')
      : i18n.t('sheets:options.downloadFailedHint'),
    'error',
  );
}
