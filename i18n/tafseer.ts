// @ai-generated
import {currentLanguage, type AppLanguage} from './language';
import {SOURCE_LANGUAGE, getLanguageConfig} from './languages';
import {resources} from './resources';

interface HomeTables {
  languages?: Record<string, string>;
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

export function getTafseerLanguageDisplayName(
  editionLanguage: string,
  language: AppLanguage = currentLanguage,
): string {
  const codes: Record<string, string> = {
    arabic: 'ar',
    english: 'en',
    bengali: 'bn',
    urdu: 'ur',
    russian: 'ru',
    kurdish: 'ku',
  };
  const normalized = editionLanguage.trim().toLowerCase();
  const names = homeTable(language, 'languages');
  return names[codes[normalized] ?? normalized] ?? editionLanguage;
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

export function isPreferredTafseerLanguage(
  editionLanguage: string,
  language: AppLanguage = currentLanguage,
): boolean {
  const normalized = editionLanguage.trim().toLowerCase();
  return (
    normalized === language ||
    normalized === getLanguageConfig(language).englishName.toLowerCase()
  );
}

/** Sort a copy at call sites so persisted selections and metadata stay intact. */
export function compareTafaseer(
  a: NamedTafseer & {language: string},
  b: NamedTafseer & {language: string},
): number {
  return (
    Number(isPreferredTafseerLanguage(b.language)) -
      Number(isPreferredTafseerLanguage(a.language)) ||
    getTafseerDisplayName(a).localeCompare(
      getTafseerDisplayName(b),
      currentLanguage,
    )
  );
}
