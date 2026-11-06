// @ai-generated
import {Alert} from 'react-native';
import i18n from '@/i18n';
import {useTranslationStore} from '@/store/translationStore';
import {useTafseerStore} from '@/store/tafseerStore';
import type {InstalledContent} from './qfInstalledContentSync';

export async function readInstalledContent(): Promise<InstalledContent> {
  const translations = useTranslationStore.getState();
  const tafseer = useTafseerStore.getState();
  await Promise.all([
    translations.loadDownloadedMeta().catch(() => undefined),
    tafseer.loadDownloadedMeta().catch(() => undefined),
  ]);
  return {
    translations: useTranslationStore
      .getState()
      .downloadedMeta.map(meta => meta.identifier),
    tafsirs: useTafseerStore
      .getState()
      .downloadedMeta.map(meta => meta.identifier),
  };
}

/**
 * Asks once whether to download editions installed on the user's other
 * devices, then downloads them one at a time in the background.
 */
export function offerContentDownloads(
  missing: InstalledContent,
): Promise<void> {
  return new Promise(resolve => {
    Alert.alert(
      i18n.t('settings:qfAccount.contentOffer.title'),
      offerMessage(missing),
      [
        {
          text: i18n.t('settings:qfAccount.contentOffer.notNow'),
          style: 'cancel',
          onPress: () => resolve(),
        },
        {
          text: i18n.t('settings:qfAccount.contentOffer.download'),
          onPress: () => {
            resolve();
            downloadSequentially(missing).catch(() => undefined);
          },
        },
      ],
      {cancelable: true, onDismiss: () => resolve()},
    );
  });
}

function offerMessage(missing: InstalledContent): string {
  const translations = i18n.t('settings:qfAccount.contentOffer.translations', {
    count: missing.translations.length,
  });
  const tafsirs = i18n.t('settings:qfAccount.contentOffer.tafsirs', {
    count: missing.tafsirs.length,
  });
  if (missing.translations.length && missing.tafsirs.length) {
    return i18n.t('settings:qfAccount.contentOffer.messageBoth', {
      translations,
      tafsirs,
    });
  }
  return missing.translations.length
    ? i18n.t('settings:qfAccount.contentOffer.messageTranslations', {
        translations,
      })
    : i18n.t('settings:qfAccount.contentOffer.messageTafsirs', {tafsirs});
}

async function downloadSequentially(missing: InstalledContent) {
  for (const id of missing.translations) {
    try {
      await useTranslationStore.getState().downloadTranslation(id);
    } catch (error) {
      console.warn('[QfContentSync] Translation download failed:', id, error);
    }
  }
  for (const id of missing.tafsirs) {
    try {
      await useTafseerStore.getState().downloadTafseer(id);
    } catch (error) {
      console.warn('[QfContentSync] Tafsir download failed:', id, error);
    }
  }
}
