import {
  initContentSync,
  type ContentSyncHost,
} from '@/services/content/contentSync';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTranslationStore} from '@/store/translationStore';

// The app state content sync reads, wired here so contentSync itself does
// not import the stores.
const host: ContentSyncHost = {
  selectedTranslationId: () =>
    useMushafSettingsStore.getState().selectedTranslationId,
  reloadTranslations: () => useTranslationStore.getState().loadDownloadedMeta(),
};

/**
 * Starts content sync once app initialization (including the tafseer DB) has
 * completed. Fire-and-forget: failures are logged and never block the splash.
 */
export function startContentSyncAfterInit(
  initPromise: Promise<unknown>,
): Promise<void> {
  return initPromise.then(
    () =>
      initContentSync(host).catch((error: unknown) => {
        console.warn('[ContentSync] init failed', error);
      }),
    (error: unknown) => {
      console.warn('[ContentSync] not started: app init failed', error);
    },
  );
}
