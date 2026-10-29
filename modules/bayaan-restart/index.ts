// @ai-generated
import {requireOptionalNativeModule} from 'expo';

interface BayaanRestartNative {
  restart: (rtl: boolean) => void;
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
