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

// Translations with no Quran Foundation edition, removed once on upgrade.
export function removedTranslationsMessage(names: readonly string[]): string {
  return i18n.t('content:sync.translationsRemoved', {
    count: names.length,
    list: names.join(', '),
  });
}

export function showRemovedTranslationsNotice(names: readonly string[]): void {
  if (names.length === 0) return;
  showToast(
    i18n.t('content:sync.translationsRemovedTitle', {count: names.length}),
    removedTranslationsMessage(names),
    'none',
  );
}

// A refused ticket (withdrawn or unknown key) is not a connectivity problem.
export function tafseerDownloadFailure(error: unknown): AlertCopy {
  if (isContentNotOffered(error)) {
    return {
      title: i18n.t('home:translations.notOfferedTitle'),
      message: i18n.t('home:translations.tafseerNotOffered'),
    };
  }
  return {
    title: i18n.t('home:translations.downloadFailedTitle'),
    message: i18n.t('home:translations.tafseerDownloadFailed'),
  };
}

export function translationDownloadFailure(error: unknown): AlertCopy {
  if (isContentNotOffered(error)) {
    return {
      title: i18n.t('home:translations.notOfferedTitle'),
      message: i18n.t('home:translations.translationNotOffered'),
    };
  }
  return {
    title: i18n.t('home:translations.downloadFailedTitle'),
    message: i18n.t('home:translations.translationDownloadFailed'),
  };
}
