// Manifest meta carries QF's language name ("english", "bosnian"); older
// fixtures and AlQuranCloud editions carry ISO codes. The local databases
// store English display names ("English").
const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic',
  bn: 'Bengali',
  en: 'English',
  fa: 'Persian',
  fr: 'French',
  id: 'Indonesian',
  ku: 'Kurdish',
  ru: 'Russian',
  tr: 'Turkish',
  ur: 'Urdu',
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
