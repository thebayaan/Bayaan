import i18n from '@/i18n';
import {showToast} from '@/utils/toastUtils';
import type {WithdrawalNotice} from '@/types/content';
import {isContentNotOffered} from './contentApi';

export interface AlertCopy {
  title: string;
  message: string;
}

export function showWithdrawalNotice(notice: WithdrawalNotice): void {
  showToast(
    i18n.t('content:sync.removedTitle'),
    i18n.t('content:sync.removed', {name: notice.name}),
    'none',
  );
}

// A refused ticket (withdrawn or unknown key) is not a connectivity problem.
export function tafseerDownloadFailure(error: unknown): AlertCopy {
  if (isContentNotOffered(error)) {
    return {
      title: i18n.t('home:translations.tafseerNotOfferedTitle'),
      message: i18n.t('home:translations.tafseerNotOffered'),
    };
  }
  return {
    title: i18n.t('home:translations.downloadFailedTitle'),
    message: i18n.t('home:translations.tafseerDownloadFailed'),
  };
}
