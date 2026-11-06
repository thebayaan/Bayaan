import {SOURCE_LANGUAGE} from '@/i18n/languages';
import {resources} from '@/i18n/resources';

// Manifest meta carries QF's language name ("english", "bosnian"); the
// contract fixtures and AlQuranCloud-era downloads carry ISO codes. The local
// databases store English display names ("English"). ISO codes resolve
// through home.json's `languages` table, the canonical code -> name map that
// i18n/languageNames also reads (imported directly, as that module loads
// react-native).
const CANONICAL_NAMES: Readonly<Record<string, string>> =
  resources[SOURCE_LANGUAGE].home.languages;

// What the canonical table lacks: QF names whose display name differs from
// the title-cased name, and ISO codes the UI does not name.
const CONTENT_ONLY_NAMES: Readonly<Record<string, string>> = {
  azeri: 'Azerbaijani',
  divehi: 'Dhivehi',
  farsi: 'Persian',
  sinhalese: 'Sinhala',
  ber: 'Amazigh',
  bg: 'Bulgarian',
  ce: 'Chechen',
  ps: 'Pashto',
  sd: 'Sindhi',
  tg: 'Tajik',
};

function ownName(
  table: Readonly<Record<string, string>>,
  key: string,
): string | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

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
  const known =
    ownName(CONTENT_ONLY_NAMES, lower) ?? ownName(CANONICAL_NAMES, lower);
  if (known) return known;
  if (lower.length <= 3) return undefined;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
