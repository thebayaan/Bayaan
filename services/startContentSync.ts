import {initContentSync} from '@/services/content/contentSync';

/**
 * Starts content sync once app initialization (including the tafseer DB) has
 * completed. Fire-and-forget: failures are logged and never block the splash.
 */
export function startContentSyncAfterInit(
  initPromise: Promise<unknown>,
): Promise<void> {
  return initPromise.then(
    () =>
      initContentSync().catch((error: unknown) => {
        console.warn('[ContentSync] init failed', error);
      }),
    () => undefined,
  );
}
