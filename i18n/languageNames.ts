// @ai-generated
import {currentLanguage, type AppLanguage} from './language';
import {SOURCE_LANGUAGE, getLanguageConfig} from './languages';
import {resources} from './resources';

/** home.json's `languages` table (code → name) for `language`, English filling gaps. */
function languageNames(language: AppLanguage): Record<string, string> {
  const source: Record<string, string> =
    resources[SOURCE_LANGUAGE].home.languages;
  const localized: Record<string, string> = resources[language].home.languages;
  return {...source, ...localized};
}

// Lower-cased English language name → code, from the English table itself.
const CODES_BY_ENGLISH_NAME: ReadonlyMap<string, string> = new Map(
  Object.entries(languageNames(SOURCE_LANGUAGE)).map(([code, name]) => [
    name.toLowerCase(),
    code,
  ]),
);

/**
 * Name a catalogue language in the UI language. Translation and tafseer
 * editions carry an English language name ("Urdu"); a language code ("ur")
 * works too. Unknown names come back as given.
 */
export function getEnglishLanguageDisplayName(
  name: string,
  language: AppLanguage = currentLanguage,
): string {
  const normalized = name.trim().toLowerCase();
  const code = CODES_BY_ENGLISH_NAME.get(normalized) ?? normalized;
  return languageNames(language)[code] ?? name;
}

/** Whether a catalogue language (English name or code) is the UI language. */
export function isPreferredLanguage(
  name: string,
  language: AppLanguage = currentLanguage,
): boolean {
  const normalized = name.trim().toLowerCase();
  return (
    normalized === language ||
    normalized === getLanguageConfig(language).englishName.toLowerCase()
  );
}

/**
 * Order catalogue language groups: the UI language first, then by name as
 * the reader sees it. In English that is English, then alphabetical.
 */
export function compareLanguageGroups(
  a: string,
  b: string,
  language: AppLanguage = currentLanguage,
): number {
  return (
    Number(isPreferredLanguage(b, language)) -
      Number(isPreferredLanguage(a, language)) ||
    getEnglishLanguageDisplayName(a, language).localeCompare(
      getEnglishLanguageDisplayName(b, language),
      language,
    )
  );
}
