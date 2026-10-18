import React, {useEffect, useSyncExternalStore} from 'react';
import {bootApp} from '@/services/appBoot';
import {
  ExpoAudioProvider,
  isPhoneProviderMounted,
  subscribePhoneProvider,
} from '@/services/audio/ExpoAudioProvider';

/** AppRegistry name of the headless root BayaanLibraryService starts. */
export const CAR_ROOT_COMPONENT = 'BayaanCarRoot';

/**
 * Headless task Android runs while a car is connected. It never finishes on
 * its own (native finishes it on disconnect); while it runs, React Native
 * keeps JS timers going with no resumed Activity.
 */
export const CAR_KEEP_ALIVE_TASK = 'BayaanCarKeepAlive';

export function carKeepAliveTask(): Promise<void> {
  return new Promise<void>(() => undefined);
}

/**
 * Headless root that Android Auto starts when the phone app is not open. It
 * boots the app services (which start the car integration) and owns the
 * player until the phone layout mounts its own provider, then steps aside.
 * Renders no UI.
 */
export function CarRoot(): React.JSX.Element | null {
  const phoneMounted = useSyncExternalStore(
    subscribePhoneProvider,
    isPhoneProviderMounted,
  );

  useEffect(() => {
    bootApp().catch((error: unknown) => {
      if (__DEV__) console.warn('[CarRoot] boot failed', error);
    });
  }, []);

  if (phoneMounted) return null;
  return <ExpoAudioProvider owner="car">{null}</ExpoAudioProvider>;
}
