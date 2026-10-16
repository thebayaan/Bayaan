// @ai-generated
import {SURAHS} from '@/data/surahData';
import {currentLanguage, type AppLanguage} from './language';
import {DIGIT_ZERO, getLanguageConfig} from './languages';
import {getAllContentPacks, getContentPack} from './packs';

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

interface ArabicReciterNames {
  byId: Readonly<Record<string, string>>;
  byKey: ReadonlyMap<string, string>;
}

let arabicReciterNames: ArabicReciterNames | null = null;

/** Bundled Arabic reciter names, loaded only when Arabic names are shown. */
function getArabicReciterNames(): ArabicReciterNames {
  if (!arabicReciterNames) {
    const byId: Record<string, string> = require('@/data/reciterNamesAr.json');
    const fallback: {
      id: string;
      name: string;
    }[] = require('@/data/reciters-fallback.json');
    const byKey = new Map<string, string>();
    for (const reciter of fallback) {
      const arabic = byId[reciter.id];
      if (arabic) {
        byKey.set(reciterNameKey(reciter.name), arabic);
      }
    }
    arabicReciterNames = {byId, byKey};
  }
  return arabicReciterNames;
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
  const {groupSeparator, secondaryGroupSize} = getLanguageConfig(language);
  const integer = Math.trunc(value);
  const digits = Math.abs(integer).toString();
  // First group of 3 from the right, then groups of `secondaryGroupSize`.
  const head = digits.slice(0, -3);
  const groups = head
    ? [
        ...(head.match(
          new RegExp(
            `\\d{1,${secondaryGroupSize}}(?=(\\d{${secondaryGroupSize}})*$)`,
            'g',
          ),
        ) ?? []),
        digits.slice(-3),
      ]
    : [digits];
  const grouped = (integer < 0 ? '-' : '') + groups.join(groupSeparator);
  return localizeDigits(grouped, language);
}

interface NamedSurah {
  id?: number;
  name: string;
  name_arabic: string;
}

const SURAH_ID_BY_NAME = new Map(SURAHS.map(surah => [surah.name, surah.id]));

function transliteratedSurahName(
  surah: NamedSurah,
  language: AppLanguage,
): string | undefined {
  const id = surah.id ?? SURAH_ID_BY_NAME.get(surah.name);
  return id === undefined
    ? undefined
    : getContentPack(language).surahNames?.[String(id)];
}

/** Every bundled phonetic spelling of a surah's name, for search. */
export function getSurahNameTransliterations(surahId: number): string[] {
  return getAllContentPacks().flatMap(({surahNames}) => {
    const name = surahNames?.[String(surahId)];
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
      : getContentPack(language).surahMeanings?.[String(id)];
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

function ownScriptReciterName(
  reciter: NamedReciter,
  language: AppLanguage,
): string | undefined {
  return (
    reciter.names?.[language] ??
    (reciter.id
      ? getContentPack(language).reciterNames?.[reciter.id]
      : undefined)
  );
}

/** Every bundled or API spelling of a reciter's name, for search. */
export function getReciterNameTransliterations(
  reciter: NamedReciter,
): string[] {
  const bundled = getAllContentPacks().map(({reciterNames}) =>
    reciter.id ? reciterNames?.[reciter.id] : undefined,
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
    const byId = getArabicReciterNames().byId[reciter.id];
    if (byId) {
      return byId;
    }
  }
  return (
    getArabicReciterNames().byKey.get(reciterNameKey(reciter.name)) ??
    reciter.name
  );
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
