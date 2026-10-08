import {showToast} from '@/utils/toastUtils';
import type {WithdrawalNotice} from '@/types/content';

export function showWithdrawalNotice(notice: WithdrawalNotice): void {
  showToast(
    'Content removed',
    `${notice.name} was withdrawn by its publisher via Quran Foundation.`,
    'none',
  );
}
