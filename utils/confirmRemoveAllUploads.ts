// @ai-generated
import {confirmDestructive} from '@/utils/confirmDestructive'; // @ai
import i18n from '@/i18n';

/**
 * Ask before wiping every imported recitation. Uploads are the user's own
 * audio files and can't be re-downloaded, so this must never run on a single
 * tap from the options sheet.
 */
export function confirmRemoveAllUploads(deleteAll: () => Promise<void>): void {
  confirmDestructive({
    title: i18n.t('collection:uploadsScreen.removeAllTitle'),
    message: i18n.t('collection:uploadsScreen.removeAllConfirm'),
    confirmText: i18n.t('common:actions.remove'),
    cancelText: i18n.t('common:actions.cancel'),
    onConfirm: () => {
      deleteAll().catch(error => {
        console.error('Error removing all uploads:', error);
      });
    },
  });
}
