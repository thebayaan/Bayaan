// @ai-generated
// The single list of UI languages Bayaan ships, and what the app needs to
// know about each one. Code asks this registry for a property ("is this
// language RTL?", "which digits?") instead of comparing language codes, so
// adding a language is a new entry here plus its locale files.
//
// No React Native imports: i18next.config.ts and the Jest suites read this
// file outside the app. See docs/i18n/README.md.

export const SOURCE_LANGUAGE = 'en';

/** Every shipped or in-progress UI language, as BCP 47 tags without region. */
export const SUPPORTED_LANGUAGES = ['en', 'ar', 'am'] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** ISO 15924 script code, the same value Intl.Locale#maximize() reports. */
export type Script = 'Latn' | 'Arab' | 'Ethi';

/** CLDR numbering system used for digits in UI text. */
export type Digits = 'latn' | 'arab';

/** Code point of the digit zero in each numbering system. */
export const DIGIT_ZERO: Readonly<Record<Digits, number>> = {
  latn: 0x30,
  arab: 0x660,
};

/** Font family the Manrope style aliases resolve to (see i18n/fonts.ts). */
export type UiFont = 'manrope' | 'plexSansArabic' | 'manropeEthiopic';

export interface LanguageConfig {
  code: AppLanguage;
  /** The language's name in its own script, shown in the language picker. */
  endonym: string;
  /** English name. Also matches catalogue language fields ("arabic"). */
  englishName: string;
  direction: 'ltr' | 'rtl';
  script: Script;
  digits: Digits;
  /** CLDR separators for `digits` (checked against Intl in the tests). */
  groupSeparator: string;
  decimalSeparator: string;
  uiFont: UiFont;
  /** Display transliteration of the canonical Bayaan brand; null keeps its spelling. */
  bayaanTransliteration: string | null;
  /** False for cursive scripts, where letter spacing breaks joining. */
  allowsLetterSpacing: boolean;
  /**
   * Which side of data that only exists in Arabic and English to show:
   * surah names, adhkar category titles, tafsir edition titles.
   */
  bilingualContent: 'ar' | 'en';
  /**
   * Readers understand Arabic: the English translation starts off and tafsir
   * comes before translations. Transliteration also starts off for any
   * Arabic-script language (see `defaultShowTransliteration`).
   */
  understandsArabic: boolean;
  /**
   * 'shipped' languages must be complete (enforced by the locale tests and
   * CI). 'inProgress' languages may have missing keys, which fall back to
   * English, and are only offered in development builds.
   */
  status: 'shipped' | 'inProgress';
}

export const LANGUAGES: Readonly<Record<AppLanguage, LanguageConfig>> = {
  en: {
    code: 'en',
    endonym: 'English',
    englishName: 'English',
    direction: 'ltr',
    script: 'Latn',
    digits: 'latn',
    groupSeparator: ',',
    decimalSeparator: '.',
    uiFont: 'manrope',
    bayaanTransliteration: null,
    allowsLetterSpacing: true,
    bilingualContent: 'en',
    understandsArabic: false,
    status: 'shipped',
  },
  ar: {
    code: 'ar',
    endonym: 'العربية',
    englishName: 'Arabic',
    direction: 'rtl',
    script: 'Arab',
    digits: 'arab',
    groupSeparator: '٬',
    decimalSeparator: '٫',
    uiFont: 'plexSansArabic',
    bayaanTransliteration: null,
    allowsLetterSpacing: false,
    bilingualContent: 'ar',
    understandsArabic: true,
    status: 'shipped',
  },
  am: {
    code: 'am',
    endonym: 'አማርኛ',
    englishName: 'Amharic',
    direction: 'ltr',
    script: 'Ethi',
    digits: 'latn',
    groupSeparator: ',',
    decimalSeparator: '.',
    uiFont: 'manropeEthiopic',
    bayaanTransliteration: 'በያን',
    allowsLetterSpacing: true,
    bilingualContent: 'en',
    understandsArabic: false,
    status: 'inProgress',
  },
};

/** Languages complete enough for release builds. */
export const SHIPPED_LANGUAGES: AppLanguage[] = SUPPORTED_LANGUAGES.filter(
  language => LANGUAGES[language].status === 'shipped',
);

export function isAppLanguage(value: unknown): value is AppLanguage {
  return (
    typeof value === 'string' &&
    SUPPORTED_LANGUAGES.some(language => language === value)
  );
}

export function getLanguageConfig(language: AppLanguage): LanguageConfig {
  return LANGUAGES[language];
}

/** BCP 47 locale for Intl date formatting. */
export function getIntlLocale(language: AppLanguage): string {
  return language === SOURCE_LANGUAGE ? 'en-US' : language;
}
