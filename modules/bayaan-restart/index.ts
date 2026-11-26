// @ai-generated
import {requireOptionalNativeModule} from 'expo';

interface BayaanRestartNative {
  restart: (rtl: boolean) => void;
  // Missing from a native build older than this JS (an update over the air).
  launchedFromLauncher?: () => boolean;
}

// Android only. iOS cannot relaunch an app, and an in-process JS reload crashes
// on React Native 0.86 (see i18n/language.ts), so iOS has no native module.
const native =
  requireOptionalNativeModule<BayaanRestartNative>('BayaanRestart');

/** Whether this build can relaunch the app process. */
export const canRestartApp = native != null;

/**
 * Saves the native layout direction and relaunches the app in a new process.
 * Does not return when the restart starts; returns false if it cannot.
 */
export function restartApp(rtl: boolean): boolean {
  if (!native) {
    return false;
  }
  try {
    native.restart(rtl);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the screen on show was opened from the launcher, with no link and
 * no shared file to hand over. restartApp() starts the app again the way the
 * launcher does, so it would lose either. False when it cannot tell.
 */
export function launchedFromLauncher(): boolean {
  try {
    return native?.launchedFromLauncher?.() === true;
  } catch {
    return false;
  }
}
