// @ai-generated
import {useSyncExternalStore} from 'react';
import {AppState} from 'react-native';

function subscribe(onChange: () => void): () => void {
  const subscription = AppState.addEventListener('change', onChange);
  return () => subscription.remove();
}

function getSnapshot(): boolean {
  return AppState.currentState !== 'background';
}

/**
 * False while the app is in the background, true otherwise. `inactive` (the
 * iOS Control Center, a call banner) counts as foreground, so nothing that is
 * still on screen stops updating.
 *
 * For UI that keeps changing during a long background listen: on Android
 * every view update made in the background is queued and applied in the
 * first frame on return, so the return waits behind all of them.
 */
export function useAppForeground(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
