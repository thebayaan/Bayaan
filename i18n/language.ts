// @ai-generated
import {Alert, DevSettings, I18nManager} from 'react-native';
import {createMMKV} from 'react-native-mmkv';
import {reloadAppAsync} from 'expo';
import {getLocales} from 'expo-localization';
import * as Updates from 'expo-updates';

import {
  LANGUAGES,
  SOURCE_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getLanguageConfig,
  isAppLanguage,
  type AppLanguage,
} from './languages';
import {resources} from './resources';

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
const RTL_RELOAD_GUARD_KEY = 'rtl_reload_attempted_v3';

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

/** Language for this app session. Fixed until the next JS reload. */
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

interface RestartText {
  title?: string;
  message?: string;
}

/** Restart alert strings, falling back to English for incomplete languages. */
function restartText(): Required<RestartText> {
  const source = resources[SOURCE_LANGUAGE].common.languageRestart;
  const common: {languageRestart?: RestartText} =
    resources[currentLanguage].common;
  return {
    title: common.languageRestart?.title ?? source.title,
    message: common.languageRestart?.message ?? source.message,
  };
}

async function reloadApp(): Promise<void> {
  // Reload the React Native runtime in both development and standalone builds,
  // including builds with OTA updates disabled.
  try {
    await reloadAppAsync('language direction change');
    return;
  } catch {
    // Not available in every runtime.
  }
  try {
    await Updates.reloadAsync();
    return;
  } catch {
    // Updates.reloadAsync throws in development builds.
  }
  if (__DEV__) {
    DevSettings.reload();
    return;
  }
  // i18n/index.ts imports this file, so read the strings from the resources.
  const {title, message} = restartText();
  Alert.alert(title, message);
}

/**
 * Applies the layout direction for `language`. Direction changes only take
 * effect after a reload, so this returns whether a reload is required.
 */
function applyDirection(language: AppLanguage): boolean {
  const shouldBeRTL = isRTLLanguage(language);
  const needsReload =
    I18nManager.isRTL !== shouldBeRTL ||
    (shouldBeRTL && !I18nManager.doLeftAndRightSwapInRTL);
  I18nManager.allowRTL(shouldBeRTL);
  I18nManager.swapLeftAndRightInRTL(true);
  // Write both directions even if the cached JS isRTL already matches. The
  // native persisted flag may have changed since those constants were read.
  I18nManager.forceRTL(shouldBeRTL);
  return needsReload;
}

export async function setLanguagePreference(
  preference: LanguagePreference,
): Promise<void> {
  storage.set(PREFERENCE_KEY, preference);
  storage.remove(RTL_RELOAD_GUARD_KEY);
  const nextLanguage = resolveLanguage(preference);
  const directionChanged = applyDirection(nextLanguage);
  if (directionChanged || nextLanguage !== currentLanguage) {
    await reloadApp();
  }
}

/**
 * Called once at startup. If the native layout direction disagrees with the
 * resolved language (e.g. first launch on an Arabic device), force it and
 * reload once. The guard prevents a reload loop if the platform refuses.
 */
export function bootstrapDirection(): void {
  const needsReload = applyDirection(currentLanguage);
  if (!needsReload) {
    storage.remove(RTL_RELOAD_GUARD_KEY);
    return;
  }
  if (storage.getString(RTL_RELOAD_GUARD_KEY) === currentLanguage) {
    return;
  }
  storage.set(RTL_RELOAD_GUARD_KEY, currentLanguage);
  void reloadApp();
}
