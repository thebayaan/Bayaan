import {
  BUNDLED_TRANSLATIONS,
  type BundledTranslationId,
} from '@/types/translation';

interface BundledVerseEntry {
  t: string;
  f?: Record<string, string>;
}

type BundledTranslationData = Record<string, BundledVerseEntry>;

// Module-scope data (require() is cached by Metro — zero cost after first load)
const saheehData =
  require('@/data/SaheehInternational.translation-with-footnote-tags.json') as BundledTranslationData;
const clearQuranData =
  require('@/data/clear-quran-translation.json') as BundledTranslationData;

const BUNDLED_DATA: Record<BundledTranslationId, BundledTranslationData> = {
  saheeh: saheehData,
  'clear-quran': clearQuranData,
};

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

export function getBundledTranslation(
  verseKey: string,
  translationId: BundledTranslationId,
): string {
  return BUNDLED_DATA[translationId][verseKey]?.t ?? '';
}

export function getBundledTranslationRaw(
  verseKey: string,
  translationId: BundledTranslationId,
): string {
  const raw = BUNDLED_DATA[translationId][verseKey]?.t ?? '';
  return stripHtml(raw);
}

export function getBundledFootnotes(
  verseKey: string,
  translationId: BundledTranslationId,
): Record<string, string> | undefined {
  return BUNDLED_DATA[translationId][verseKey]?.f;
}

// Module-scope name registry for remote translations.
// Populated by translationStore when editions are fetched or downloads loaded.
const remoteNameRegistry: Record<string, string> = {};

export function registerRemoteTranslationName(
  identifier: string,
  name: string,
): void {
  remoteNameRegistry[identifier] = name;
}

export function getTranslationName(translationId: string): string {
  if (translationId in BUNDLED_TRANSLATIONS) {
    return BUNDLED_TRANSLATIONS[translationId as BundledTranslationId].name;
  }
  if (translationId in remoteNameRegistry) {
    return remoteNameRegistry[translationId];
  }
  // Fallback: format the identifier nicely (e.g., "en.pickthall" → "en.pickthall")
  return translationId;
}

export function isBundledTranslation(id: string): id is BundledTranslationId {
  return id in BUNDLED_TRANSLATIONS;
}

// Cache for the currently-active remote translation (populated by enhancedVerseData).
// This allows sync lookups from sheets (ShareContent, TranslationContent, VerseActionsSheet)
// without needing to hit SQLite.
let activeRemoteTranslationCache: {
  id: string;
  data: Record<string, string>;
} | null = null;

export function setActiveRemoteTranslationCache(
  id: string,
  data: Record<string, string>,
): void {
  activeRemoteTranslationCache = {id, data};
}

export function clearActiveRemoteTranslationCache(): void {
  activeRemoteTranslationCache = null;
}

/**
 * Universal translation lookup — works for both bundled and remote translations.
 * For remote translations, uses the in-memory cache populated by enhancedVerseData.
 */
export function getTranslationText(
  verseKey: string,
  translationId: string,
): string {
  if (isBundledTranslation(translationId)) {
    return getBundledTranslation(verseKey, translationId);
  }
  if (
    activeRemoteTranslationCache &&
    activeRemoteTranslationCache.id === translationId
  ) {
    return activeRemoteTranslationCache.data[verseKey] ?? '';
  }
  return '';
}

/**
 * Universal raw translation lookup (no HTML stripping for bundled).
 */
export function getTranslationTextRaw(
  verseKey: string,
  translationId: string,
): string {
  if (isBundledTranslation(translationId)) {
    return getBundledTranslationRaw(verseKey, translationId);
  }
  if (
    activeRemoteTranslationCache &&
    activeRemoteTranslationCache.id === translationId
  ) {
    return activeRemoteTranslationCache.data[verseKey] ?? '';
  }
  return '';
}
