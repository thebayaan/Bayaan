// @ai-generated
import {SURAHS} from '@/data/surahData';
import arNamesById from '@/data/reciterNamesAr.json';
import amSurahNames from '@/data/surahNamesAm.json';
import amSurahMeanings from '@/data/surahMeaningsAm.json';
import amReciterNames from '@/data/reciterNamesAm.json';
import fallbackReciters from '@/data/reciters-fallback.json';
import {currentLanguage, type AppLanguage} from './language';
import {DIGIT_ZERO, getLanguageConfig} from './languages';

/** Display only: preserve fork names and canonical branding used in IDs/share payloads. */
export function getAppDisplayName(
  canonicalName: string,
  language: AppLanguage = currentLanguage,
): string {
  return canonicalName === 'Bayaan'
    ? (getLanguageConfig(language).bayaanTransliteration ?? canonicalName)
    : canonicalName;
}

function reciterNameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const arNamesByKey = new Map<string, string>();
for (const reciter of fallbackReciters as {id: string; name: string}[]) {
  const arabic = (arNamesById as Record<string, string>)[reciter.id];
  if (arabic) {
    arNamesByKey.set(reciterNameKey(reciter.name), arabic);
  }
}

/** Converts ASCII digits to the language's digits (Arabic-Indic for Arabic). */
export function localizeDigits(
  value: string | number,
  language: AppLanguage = currentLanguage,
): string {
  const text = String(value);
  const zero = DIGIT_ZERO[getLanguageConfig(language).digits];
  if (zero === DIGIT_ZERO.latn) {
    return text;
  }
  return text.replace(/[0-9]/g, digit =>
    String.fromCodePoint(zero + Number(digit)),
  );
}

function usesArabicContent(language: AppLanguage): boolean {
  return getLanguageConfig(language).bilingualContent === 'ar';
}

/** Decimal separator that matches the language's digits. */
export function decimalSeparator(
  language: AppLanguage = currentLanguage,
): string {
  return getLanguageConfig(language).decimalSeparator;
}

/** Formats an integer with grouping separators and localized digits. */
export function formatNumber(
  value: number,
  language: AppLanguage = currentLanguage,
): string {
  const grouped = Math.trunc(value)
    .toString()
    .replace(
      /\B(?=(\d{3})+(?!\d))/g,
      getLanguageConfig(language).groupSeparator,
    );
  return localizeDigits(grouped, language);
}

interface NamedSurah {
  id?: number;
  name: string;
  name_arabic: string;
}

/**
 * Phonetic spellings of surah names in a language's own script, keyed by
 * surah number. Transliterated from the Arabic, never translated by meaning.
 * Languages without an entry show the Latin transliteration.
 */
const SURAH_NAME_TRANSLITERATIONS: Partial<
  Record<AppLanguage, Readonly<Record<string, string>>>
> = {am: amSurahNames};

const SURAH_ID_BY_NAME = new Map(SURAHS.map(surah => [surah.name, surah.id]));

function transliteratedSurahName(
  surah: NamedSurah,
  language: AppLanguage,
): string | undefined {
  const id = surah.id ?? SURAH_ID_BY_NAME.get(surah.name);
  return id === undefined
    ? undefined
    : SURAH_NAME_TRANSLITERATIONS[language]?.[String(id)];
}

/** Every bundled phonetic spelling of a surah's name, for search. */
export function getSurahNameTransliterations(surahId: number): string[] {
  return Object.values(SURAH_NAME_TRANSLITERATIONS).flatMap(names => {
    const name = names?.[String(surahId)];
    return name ? [name] : [];
  });
}

/**
 * Surah name for display: the Arabic name, the language's own phonetic
 * spelling, or the Latin transliteration.
 */
export function getSurahDisplayName(
  surah: NamedSurah,
  language: AppLanguage = currentLanguage,
): string {
  if (usesArabicContent(language)) {
    return surah.name_arabic;
  }
  return transliteratedSurahName(surah, language) ?? surah.name;
}

interface TranslatedSurah {
  id?: number;
  translated_name_english: string;
}

/**
 * Surah meanings translated into a language, keyed by surah number. Amharic
 * comes from the chapter list at https://amharicquran.com/.
 */
const SURAH_MEANING_TRANSLATIONS: Partial<
  Record<AppLanguage, Readonly<Record<string, string>>>
> = {am: amSurahMeanings};

const SURAH_ID_BY_MEANING = new Map(
  SURAHS.map(surah => [surah.translated_name_english, surah.id]),
);

/**
 * Meaning of a surah name (e.g. "The Opener"), in the language when it has
 * translated meanings, otherwise in English. Arabic shows no meaning.
 */
export function getSurahMeaning(
  surah: TranslatedSurah,
  language: AppLanguage = currentLanguage,
): string | null {
  if (usesArabicContent(language)) {
    return null;
  }
  const id = surah.id ?? SURAH_ID_BY_MEANING.get(surah.translated_name_english);
  const translated =
    id === undefined
      ? undefined
      : SURAH_MEANING_TRANSLATIONS[language]?.[String(id)];
  return translated ?? surah.translated_name_english;
}

interface TitledTrack {
  title: string;
  surahId?: string;
  isUserUpload?: boolean;
}

/**
 * Track title for display. Surah tracks are titled with the English surah
 * name when queued, so the display name is resolved from `surahId`. User
 * uploads keep their own titles.
 */
export function getTrackDisplayTitle(
  track: TitledTrack,
  language: AppLanguage = currentLanguage,
): string {
  if (track.isUserUpload || !track.surahId) {
    return track.title;
  }
  const surah = SURAHS[Number(track.surahId) - 1];
  if (!surah) {
    return track.title;
  }
  if (usesArabicContent(language)) {
    return surah.name_arabic;
  }
  return transliteratedSurahName(surah, language) ?? track.title;
}

interface NamedReciter {
  id?: string;
  name: string;
  name_arabic?: string | null;
  /** The API's display names by language code, e.g. `{am: '...'}`. */
  names?: Readonly<Record<string, string>> | null;
}

/**
 * Bundled phonetic spellings of reciter names, keyed by reciter id, for when
 * the API has no `names` entry (offline first launch, queued tracks).
 * Transliterated, never translated.
 */
const RECITER_NAME_TRANSLITERATIONS: Partial<
  Record<AppLanguage, Readonly<Record<string, string>>>
> = {am: amReciterNames};

function ownScriptReciterName(
  reciter: NamedReciter,
  language: AppLanguage,
): string | undefined {
  return (
    reciter.names?.[language] ??
    (reciter.id
      ? RECITER_NAME_TRANSLITERATIONS[language]?.[reciter.id]
      : undefined)
  );
}

/** Every bundled or API spelling of a reciter's name, for search. */
export function getReciterNameTransliterations(
  reciter: NamedReciter,
): string[] {
  const bundled = Object.values(RECITER_NAME_TRANSLITERATIONS).map(names =>
    reciter.id ? names?.[reciter.id] : undefined,
  );
  return [...Object.values(reciter.names ?? {}), ...bundled].filter(
    (name): name is string => Boolean(name),
  );
}

/**
 * Reciter name for display. A spelling in the language's own script comes
 * first: the API's `names[language]`, then the bundled file. Languages that
 * show Arabic names then prefer the API's `name_arabic`, then the bundled
 * Arabic name (matched by id, then by English name). Everything else shows
 * the English name. Reciter names are data, not
 * UI strings: they never go in the locale files (see docs/i18n/README.md).
 */
export function getReciterDisplayName(
  reciter: NamedReciter,
  language: AppLanguage = currentLanguage,
): string {
  const ownScript = ownScriptReciterName(reciter, language);
  if (ownScript) {
    return ownScript;
  }
  if (!usesArabicContent(language)) {
    return reciter.name;
  }
  if (reciter.name_arabic) {
    return reciter.name_arabic;
  }
  if (reciter.id) {
    const byId = (arNamesById as Record<string, string>)[reciter.id];
    if (byId) {
      return byId;
    }
  }
  return arNamesByKey.get(reciterNameKey(reciter.name)) ?? reciter.name;
}

/** Artist line on a queued track. Uploads keep their own name. */
export function getTrackArtistDisplay(
  track: {artist: string; reciterId?: string; isUserUpload?: boolean},
  language: AppLanguage = currentLanguage,
): string {
  if (track.isUserUpload || !track.reciterId) {
    return track.artist;
  }
  return getReciterDisplayName(
    {id: track.reciterId, name: track.artist},
    language,
  );
}
