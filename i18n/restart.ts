// @ai-generated
import {canRestartApp, restartApp} from '@/modules/bayaan-restart';
import {
  isRTLLanguage,
  resolveLanguage,
  setLanguagePreference,
  type LanguagePreference,
} from './language';

/**
 * Android can relaunch the app process so a new language applies at once. iOS
 * cannot; there the choice applies the next time the user opens the app.
 */
export const canRestartToApplyLanguage = canRestartApp;

/**
 * Saves `preference`, then relaunches the app in a new process in its language
 * and direction. Returns false if the restart could not start; the choice is
 * still saved and applies the next time the app opens.
 */
export function restartWithLanguage(preference: LanguagePreference): boolean {
  setLanguagePreference(preference);
  return restartApp(isRTLLanguage(resolveLanguage(preference)));
}
