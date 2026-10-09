import {showToast} from '@/utils/toastUtils';
import type {WithdrawalNotice} from '@/types/content';
import {isContentNotOffered} from './contentApi';

export interface AlertCopy {
  title: string;
  message: string;
}

export function showWithdrawalNotice(notice: WithdrawalNotice): void {
  showToast(
    'Content removed',
    `${notice.name} is no longer available.`,
    'none',
  );
}

// A refused ticket (withdrawn or unknown key) is not a connectivity problem.
export function tafseerDownloadFailure(error: unknown): AlertCopy {
  if (isContentNotOffered(error)) {
    return {
      title: 'Not available',
      message:
        'This tafseer is no longer offered. It may have been withdrawn by its publisher.',
    };
  }
  return {
    title: 'Download Failed',
    message:
      'Unable to download this tafseer. Please check your internet connection and try again.',
  };
}
