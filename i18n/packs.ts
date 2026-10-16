// @ai-generated
// Per-language content data: everything a language needs beyond its locale
// files, registered in one place. Each pack is required lazily, so a user
// only evaluates the data for the languages the app actually reads (the
// active one, plus all of them when search needs every spelling).
//
// Adding a language's data = one entry here. See docs/i18n/README.md.
import {SUPPORTED_LANGUAGES, type AppLanguage} from './languages';

type ById = Readonly<Record<string, string>>;

export interface ContentPack {
  /** Phonetic surah names in the language's own script, by surah number. */
  surahNames?: ById;
  /** Translated surah-name meanings, by surah number. */
  surahMeanings?: ById;
  /** Reciter names in the language's own script, by reciter id. */
  reciterNames?: ById;
}

const LOADERS: Readonly<Record<AppLanguage, () => ContentPack>> = {
  en: () => ({}),
  // Arabic names are the shared Arabic content side, not a pack (format.ts).
  ar: () => ({}),
  am: () => ({
    surahNames: require('@/data/surahNamesAm.json'),
    surahMeanings: require('@/data/surahMeaningsAm.json'),
    reciterNames: require('@/data/reciterNamesAm.json'),
  }),
};

const loaded = new Map<AppLanguage, ContentPack>();

/** The content pack for `language`, loaded on first use. */
export function getContentPack(language: AppLanguage): ContentPack {
  let pack = loaded.get(language);
  if (!pack) {
    pack = LOADERS[language]();
    loaded.set(language, pack);
  }
  return pack;
}

/** Every language's pack, for search across all bundled spellings. */
export function getAllContentPacks(): ContentPack[] {
  return SUPPORTED_LANGUAGES.map(getContentPack);
}
