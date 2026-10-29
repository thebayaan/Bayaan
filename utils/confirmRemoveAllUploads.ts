// @ai-generated
import {Alert} from 'react-native';
import i18n from '@/i18n';

/**
 * Ask before wiping every imported recitation. Uploads are the user's own
 * audio files and can't be re-downloaded, so this must never run on a single
 * tap from the options sheet.
 */
export function confirmRemoveAllUploads(deleteAll: () => Promise<void>): void {
  Alert.alert(
    i18n.t('collection:uploadsScreen.removeAllTitle'),
    i18n.t('collection:uploadsScreen.removeAllConfirm'),
    [
      {text: i18n.t('common:actions.cancel'), style: 'cancel'},
      {
        text: i18n.t('common:actions.remove'),
        style: 'destructive',
        onPress: () => {
          deleteAll().catch(error => {
            console.error('Error removing all uploads:', error);
          });
        },
      },
    ],
  );
}
