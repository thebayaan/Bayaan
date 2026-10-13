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

// Translations with no Quran Foundation edition, removed once on upgrade.
export function removedTranslationsMessage(names: readonly string[]): string {
  const list = names.join(', ');
  return names.length === 1
    ? `${list} is no longer available.`
    : `${list} are no longer available.`;
}

export function showRemovedTranslationsNotice(names: readonly string[]): void {
  if (names.length === 0) return;
  showToast(
    names.length === 1 ? 'Translation removed' : 'Translations removed',
    removedTranslationsMessage(names),
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

export function translationDownloadFailure(error: unknown): AlertCopy {
  if (isContentNotOffered(error)) {
    return {
      title: 'Not available',
      message:
        'This translation is no longer offered. It may have been withdrawn by its publisher.',
    };
  }
  return {
    title: 'Download Failed',
    message:
      'Unable to download this translation. Please check your internet connection and try again.',
  };
}
