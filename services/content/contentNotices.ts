import {showToast} from '@/utils/toastUtils';
import type {WithdrawalNotice} from '@/types/content';

export function showWithdrawalNotice(notice: WithdrawalNotice): void {
  showToast(
    'Content removed',
    `${notice.name} is no longer available.`,
    'none',
  );
}
