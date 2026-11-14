// @ai-generated
import {canRestartApp, restartApp} from '@/modules/bayaan-restart';
import {
  claimDirectionRestart,
  currentLanguage,
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

/**
 * Android, at startup: relaunches once if this process started in the wrong
 * layout direction for its language (see claimDirectionRestart). Returns
 * false when no restart is needed or possible; the launch then goes on as
 * before and the direction is right from the next launch.
 */
export function restartIfDirectionMismatched(): boolean {
  if (!canRestartApp || !claimDirectionRestart()) {
    return false;
  }
  return restartApp(isRTLLanguage(currentLanguage));
}
