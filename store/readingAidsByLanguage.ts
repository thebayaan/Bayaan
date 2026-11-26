/**
 * English reading aids keep a separate value for each UI language: the
 * verse translation and transliteration of the player and the list view,
 * the word-by-word meanings and transliteration (Word by Word, the player,
 * Word Study), and the adhkar's translation and transliteration.
 *
 * In Arabic every one starts off, and one the reader turns on there stays on
 * there. English keeps its own values, starting from its own defaults. The
 * UI language is fixed for a session (currentLanguage), so a store keeps this
 * session's values in its usual fields, which callers read, set and toggle
 * as before, and the other languages' values beside them. It saves every
 * language's values under the language's code.
 */
import {currentLanguage, type AppLanguage} from '@/i18n/language';
import {isAppLanguage} from '@/i18n/languages';

/** What one UI language saved. A reading aid it has not saved is missing. */
export type SavedReadingAids<K extends string> = Partial<Record<K, boolean>>;

/** What each UI language saved, by language code. */
export type ReadingAidsByLanguage<K extends string> = Partial<
  Record<AppLanguage, SavedReadingAids<K>>
>;

/** A store's reading aids `K` in memory. */
export type WithReadingAids<K extends string> = Record<K, boolean> & {
  /** What the UI languages other than this session's saved. */
  readingAidsInOtherLanguages: ReadingAidsByLanguage<K>;
};

/** How a store saves its reading aids `K`. */
export type PersistedReadingAids<K extends string> = {
  readingAidsByLanguage?: ReadingAidsByLanguage<K>;
};

/** `S` as saved: the reading aids of every language, none in its fields. */
export type WithPersistedReadingAids<
  S extends WithReadingAids<K>,
  K extends string,
> = Omit<S, K | 'readingAidsInOtherLanguages'> & PersistedReadingAids<K>;

/**
 * The language a value saved before per-language values becomes: English.
 * The app ran in English before it had an Arabic interface, and Arabic
 * starts with every English reading aid off.
 */
const SINGLE_VALUE_LANGUAGE: AppLanguage = 'en';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Saves and loads the reading aids `keys` of a persisted store. */
export function perLanguageReadingAids<K extends string>(keys: readonly K[]) {
  /** The booleans `value` holds for `keys`. Anything else is not saved. */
  const pick = (value: unknown): SavedReadingAids<K> => {
    const saved: SavedReadingAids<K> = {};
    if (isRecord(value)) {
      for (const key of keys) {
        const shown = value[key];
        if (typeof shown === 'boolean') {
          saved[key] = shown;
        }
      }
    }
    return saved;
  };

  return {
    /**
     * What `state` saves (the store's `partialize`): this session's values
     * under its language, beside the other languages' values, and none in
     * the store's own fields.
     */
    toPersisted<S extends WithReadingAids<K>>(
      state: S,
    ): WithPersistedReadingAids<S, K> {
      const {readingAidsInOtherLanguages, ...rest} = state;
      const persisted: Record<string, unknown> = {...rest};
      for (const key of keys) {
        delete persisted[key];
      }
      const byLanguage: ReadingAidsByLanguage<K> = {
        ...readingAidsInOtherLanguages,
      };
      const own = pick(state);
      if (Object.keys(own).length > 0) {
        byLanguage[currentLanguage] = own;
      }
      if (Object.keys(byLanguage).length > 0) {
        persisted.readingAidsByLanguage = byLanguage;
      }
      return persisted as WithPersistedReadingAids<S, K>;
    },

    /**
     * The store's `merge`: zustand's, which puts what was saved over
     * `current`, but the reading aids are what this session's language
     * saved. One it has not saved keeps its value in `current`: the store's
     * default for the language, or what the reader chose before the saved
     * state loaded.
     */
    merge<S extends WithReadingAids<K>>(persisted: unknown, current: S): S {
      if (!isRecord(persisted)) {
        return current;
      }
      const {readingAidsByLanguage, ...rest} = persisted;
      const merged: Record<string, unknown> = {...current, ...rest};
      // Only the values saved per language count: one an older shape kept
      // in the store's field is no language's.
      for (const key of keys) {
        merged[key] = current[key];
      }
      merged.readingAidsInOtherLanguages = current.readingAidsInOtherLanguages;
      if (isRecord(readingAidsByLanguage)) {
        const others: ReadingAidsByLanguage<K> = {};
        for (const [language, saved] of Object.entries(readingAidsByLanguage)) {
          if (language === currentLanguage) {
            Object.assign(merged, pick(saved));
          } else if (isAppLanguage(language)) {
            others[language] = pick(saved);
          }
        }
        merged.readingAidsInOtherLanguages = others;
      }
      return merged as S;
    },

    /**
     * Migrates a state saved with one value of each reading aid for every
     * UI language: the values become English's, and Arabic has nothing
     * saved. A value that is missing or not a boolean stays unsaved.
     */
    moveSingleValuesToEnglish(state: Record<string, unknown>): void {
      const english = pick(state);
      for (const key of keys) {
        delete state[key];
      }
      state.readingAidsByLanguage =
        Object.keys(english).length > 0
          ? {[SINGLE_VALUE_LANGUAGE]: english}
          : {};
    },
  };
}
