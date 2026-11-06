// Manifest meta carries QF's language name ("english", "bosnian"); the
// contract fixtures and AlQuranCloud-era downloads carry ISO codes. The local databases
// store English display names ("English").
const LANGUAGE_NAMES: Record<string, string> = {
  am: 'Amharic',
  ar: 'Arabic',
  az: 'Azerbaijani',
  ber: 'Amazigh',
  bg: 'Bulgarian',
  bn: 'Bengali',
  bs: 'Bosnian',
  ce: 'Chechen',
  cs: 'Czech',
  de: 'German',
  dv: 'Dhivehi',
  en: 'English',
  es: 'Spanish',
  fa: 'Persian',
  fr: 'French',
  ha: 'Hausa',
  hi: 'Hindi',
  id: 'Indonesian',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  ku: 'Kurdish',
  ml: 'Malayalam',
  ms: 'Malay',
  nl: 'Dutch',
  no: 'Norwegian',
  pl: 'Polish',
  ps: 'Pashto',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  sd: 'Sindhi',
  so: 'Somali',
  sq: 'Albanian',
  sv: 'Swedish',
  sw: 'Swahili',
  ta: 'Tamil',
  tg: 'Tajik',
  th: 'Thai',
  tr: 'Turkish',
  tt: 'Tatar',
  ug: 'Uyghur',
  ur: 'Urdu',
  uz: 'Uzbek',
  vi: 'Vietnamese',
  zh: 'Chinese',
  // QF names whose display name differs from the title-cased name.
  azeri: 'Azerbaijani',
  divehi: 'Dhivehi',
  farsi: 'Persian',
  sinhalese: 'Sinhala',
};

/**
 * The English display name for a manifest language. Undefined when blank or
 * an unmapped ISO code, so the caller's fallback (the installed row, the
 * bundled catalog) applies; an unmapped name is title-cased.
 */
export function contentLanguageName(
  language: string | undefined,
): string | undefined {
  const raw = language?.trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  const known = LANGUAGE_NAMES[lower];
  if (known) return known;
  if (lower.length <= 3) return undefined;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
