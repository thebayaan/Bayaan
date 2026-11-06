// @ai-generated
import {currentLanguage, type AppLanguage} from './language';
import {SOURCE_LANGUAGE, getLanguageConfig} from './languages';
import {resources} from './resources';
import {
  getEnglishLanguageDisplayName,
  isPreferredLanguage,
} from './languageNames';

// Older names, kept for callers outside the translations picker.
export {
  getEnglishLanguageDisplayName as getTafseerLanguageDisplayName,
  isPreferredLanguage as isPreferredTafseerLanguage,
};

interface HomeTables {
  tafseerNames?: Record<string, string>;
}

/** A home.json table for `language`, with English filling any gaps. */
function homeTable(
  language: AppLanguage,
  table: keyof HomeTables,
): Record<string, string> {
  const source: HomeTables = resources[SOURCE_LANGUAGE].home;
  const localized: HomeTables = resources[language].home;
  return {...source[table], ...localized[table]};
}

interface NamedTafseer {
  identifier?: string;
  id?: string;
  name: string;
  englishName: string;
}

/** Localize catalogue titles without changing the language of their text. */
export function getTafseerDisplayName(
  edition: NamedTafseer,
  language: AppLanguage = currentLanguage,
): string {
  const names = homeTable(language, 'tafseerNames');
  return (
    names[edition.identifier ?? edition.id ?? ''] ??
    (getLanguageConfig(language).bilingualContent === 'ar'
      ? edition.name
      : edition.englishName)
  );
}

/** Sort a copy at call sites so persisted selections and metadata stay intact. */
export function compareTafaseer(
  a: NamedTafseer & {language: string},
  b: NamedTafseer & {language: string},
): number {
  return (
    Number(isPreferredLanguage(b.language)) -
      Number(isPreferredLanguage(a.language)) ||
    getTafseerDisplayName(a).localeCompare(
      getTafseerDisplayName(b),
      currentLanguage,
    )
  );
}
