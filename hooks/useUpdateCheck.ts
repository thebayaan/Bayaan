// @ai-generated
// RFC-025 — runs the "update available" check for the card.
import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import branding from '@/config/branding';
import {
  checkForUpdate,
  isUpdateCardSnoozed,
  openStoreForUpdate,
  snoozeUpdateCard,
} from '@/services/updateCheck';

/** The check runs again on foreground at most once in this period. */
export const UPDATE_CHECK_FOREGROUND_DEBOUNCE_MS = 6 * 60 * 60 * 1000;

export interface UpdateCheckState {
  /** True when an update is available and the person did not close the card. */
  visible: boolean;
  /** Opens the store page of this app. */
  openStore: () => void;
  /** Hides the card for 7 days. */
  dismiss: () => void;
}

/**
 * Runs the check once on mount and again when the app comes to the
 * foreground (debounced). With no `branding.updateSource` it does nothing,
 * and `visible` stays false.
 */
export function useUpdateCheck(): UpdateCheckState {
  const enabled = branding.updateSource != null;
  const [visible, setVisible] = useState(false);
  const lastCheckAt = useRef(0);
  const mounted = useRef(true);

  const run = useCallback(async () => {
    lastCheckAt.current = Date.now();
    const [result, snoozed] = await Promise.all([
      checkForUpdate(),
      isUpdateCardSnoozed(),
    ]);
    if (mounted.current) setVisible(result.updateAvailable && !snoozed);
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return;
    run();
    const subscription = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (
          state === 'active' &&
          Date.now() - lastCheckAt.current > UPDATE_CHECK_FOREGROUND_DEBOUNCE_MS
        ) {
          run();
        }
      },
    );
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [enabled, run]);

  const openStore = useCallback(() => {
    openStoreForUpdate();
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    snoozeUpdateCard();
  }, []);

  return {visible, openStore, dismiss};
}
