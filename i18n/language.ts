// @ai-generated
import {I18nManager, Platform, Settings} from 'react-native';
import {createMMKV} from 'react-native-mmkv';
import {getLocales} from 'expo-localization';

import {
  LANGUAGES,
  SOURCE_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getLanguageConfig,
  isAppLanguage,
  type AppLanguage,
} from './languages';

export {SUPPORTED_LANGUAGES, type AppLanguage};
export type LanguagePreference = 'system' | AppLanguage;

/**
 * Languages offered in the picker and matched against the device language.
 * In-progress languages are development-only so a half-translated language
 * never reaches release users.
 */
export const AVAILABLE_LANGUAGES: AppLanguage[] = SUPPORTED_LANGUAGES.filter(
  language => __DEV__ || LANGUAGES[language].status === 'shipped',
);

function isAvailableLanguage(value: unknown): value is AppLanguage {
  return (
    isAppLanguage(value) &&
    AVAILABLE_LANGUAGES.some(language => language === value)
  );
}

const storage = createMMKV({id: 'i18n'});
const PREFERENCE_KEY = 'language_preference';

export function getLanguagePreference(): LanguagePreference {
  const stored = storage.getString(PREFERENCE_KEY);
  if (stored === 'system' || isAvailableLanguage(stored)) {
    return stored;
  }
  return 'system';
}

export function getDeviceLanguage(): AppLanguage {
  try {
    for (const locale of getLocales()) {
      if (isAvailableLanguage(locale.languageCode)) {
        return locale.languageCode;
      }
    }
  } catch {
    // Native module unavailable (e.g. tests) — fall through to English.
  }
  return SOURCE_LANGUAGE;
}

export function resolveLanguage(
  preference: LanguagePreference = getLanguagePreference(),
): AppLanguage {
  return preference === 'system' ? getDeviceLanguage() : preference;
}

export function isRTLLanguage(language: AppLanguage): boolean {
  return getLanguageConfig(language).direction === 'rtl';
}

/** Language for this app session. Fixed until the next launch. */
export const currentLanguage: AppLanguage = resolveLanguage();

/** Registry entry for `currentLanguage` (see i18n/languages.ts). */
export const currentLanguageConfig = getLanguageConfig(currentLanguage);

/**
 * Initial reading-aid preference only. Persisted user choices take precedence
 * and remain available in every interface language.
 */
export const defaultShowEnglishReadingAids =
  !currentLanguageConfig.understandsArabic;

/** Latin transliteration is no help to readers of an Arabic-script language. */
export const defaultShowTransliteration =
  defaultShowEnglishReadingAids && currentLanguageConfig.script !== 'Arab';

/** Whether `language` needs a layout direction other than this session's. */
function directionDiffers(language: AppLanguage): boolean {
  const shouldBeRTL = isRTLLanguage(language);
  return (
    I18nManager.isRTL !== shouldBeRTL ||
    (shouldBeRTL && !I18nManager.doLeftAndRightSwapInRTL)
  );
}

/**
 * iOS owns the app language: users change it in Settings › Apps › Bayaan ›
 * Language, and iOS relaunches the app in it. An app cannot relaunch itself on
 * iOS, so this is the only way a new language applies without the user
 * closing the app by hand. The language screen sends users there.
 */
export const languageFollowsSystemSettings = Platform.OS === 'ios';

/**
 * Persists the native layout direction for `language`. iOS and Android read it
 * when React Native starts, so it takes effect on the next launch.
 *
 * On iOS the direction is never forced. The persisted flag would outlive a
 * language change made in Settings and start the relaunched app in the old
 * direction. Allowing RTL lets React Native follow the app language iOS
 * launches with instead.
 *
 * Never reload the JS runtime in process to apply it. On React Native 0.86
 * and 0.88 bridgeless, `reloadAppAsync`, `Updates.reloadAsync` and
 * `DevSettings.reload` can crash: the old runtime may run a pending Fabric
 * render after its scheduler is torn down (0.88 dropped the
 * `enableSchedulerDelegateInvalidation` guard), and Expo modules re-register
 * while the old runtime is still being torn down. Android relaunches the whole
 * process instead (i18n/restart).
 */
function applyDirection(language: AppLanguage): void {
  if (languageFollowsSystemSettings) {
    I18nManager.allowRTL(true);
    I18nManager.swapLeftAndRightInRTL(true);
    I18nManager.forceRTL(false);
    return;
  }
  const shouldBeRTL = isRTLLanguage(language);
  I18nManager.allowRTL(shouldBeRTL);
  I18nManager.swapLeftAndRightInRTL(true);
  // Write both directions even if the cached JS isRTL already matches. The
  // native persisted flag may have changed since those constants were read.
  I18nManager.forceRTL(shouldBeRTL);
}

/**
 * Before iOS owned the language, iOS users picked it in the app. Hands such a
 * choice to iOS (the per-app `AppleLanguages` default that Settings writes) so
 * it survives, then drops the in-app preference. This session keeps the
 * language it started with; the next launch follows iOS.
 */
function migratePreferenceToSystemSettings(): void {
  const preference = getLanguagePreference();
  if (preference === 'system') {
    return;
  }
  Settings.set({AppleLanguages: [preference]});
  storage.remove(PREFERENCE_KEY);
}

/**
 * Whether choosing `preference` needs a restart to show: a different language,
 * or a layout direction other than the one this session started with.
 */
export function languageChangeRequiresRestart(
  preference: LanguagePreference,
): boolean {
  const nextLanguage = resolveLanguage(preference);
  return nextLanguage !== currentLanguage || directionDiffers(nextLanguage);
}

/**
 * Saves the preference and the native direction for the next launch. Returns
 * whether the app must restart for the change to apply.
 */
export function setLanguagePreference(preference: LanguagePreference): boolean {
  storage.set(PREFERENCE_KEY, preference);
  applyDirection(resolveLanguage(preference));
  return languageChangeRequiresRestart(preference);
}

/**
 * Called once at startup. Keeps the persisted native direction in step with
 * the resolved language (e.g. System after the device language changed). A
 * mismatch is corrected on the next launch; JS layout already follows
 * `currentLanguage` through utils/rtl. On iOS it also hands a language picked
 * in the app to iOS Settings.
 */
export function bootstrapDirection(): void {
  if (languageFollowsSystemSettings) {
    migratePreferenceToSystemSettings();
  }
  applyDirection(currentLanguage);
}
