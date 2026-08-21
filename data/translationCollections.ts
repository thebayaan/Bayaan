/**
 * Translation registry — RFC-020 `translation` filter dimension.
 *
 * Derives the list of translation languages from the active catalog: each
 * distinct `Reciter.translation` value becomes a `TranslationInfo` entry
 * with a live reciter count. Reciters with no `translation` value are
 * dropped, so the list is empty until a fork populates `Reciter.translation`
 * from its catalog (RFC-020 §1 field prerequisite) — at which point the
 * `translation` composer chip fills in automatically with no further wiring.
 */
import {RECITERS, type Reciter} from './reciterData';

export interface TranslationInfo {
  /** Kebab-case slug — e.g. "english", "urdu". Matches the URL param. */
  id: string;
  /** Display name — e.g. "English", "Spanish". */
  name: string;
  /** ISO 639-1 / 639-2 language code — e.g. "en", "ur". */
  languageCode: string;
  /** Number of reciters tied to this translation language. */
  itemCount: number;
}

/**
 * Minimal language-code map for common translation languages. Falls back to
 * the lowercased slug when a language isn't mapped (good-enough for the URL
 * slug + display).
 */
const LANGUAGE_CODE_MAP: Readonly<Record<string, string>> = {
  english: 'en',
  spanish: 'es',
  russian: 'ru',
  french: 'fr',
  urdu: 'ur',
  malay: 'ms',
  indonesian: 'id',
  turkish: 'tr',
  german: 'de',
  arabic: 'ar',
};

function slugifyLanguage(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '-');
}

/**
 * All translation languages present in the active catalog, with their
 * reciter counts. Empty when no reciter has `Reciter.translation` set.
 */
export function getAllTranslations(): TranslationInfo[] {
  const counts = new Map<string, {name: string; count: number}>();

  for (const reciter of RECITERS as Reciter[]) {
    const lang = reciter.translation?.trim();
    if (!lang) continue;
    const slug = slugifyLanguage(lang);
    const existing = counts.get(slug);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(slug, {name: lang, count: 1});
    }
  }

  return Array.from(counts.entries())
    .map(([slug, {name, count}]) => ({
      id: slug,
      name,
      languageCode: LANGUAGE_CODE_MAP[slug] ?? slug,
      itemCount: count,
    }))
    .sort((a, b) => b.itemCount - a.itemCount || a.name.localeCompare(b.name));
}
