import {
  BUNDLED_TRANSLATIONS,
  type BundledTranslationId,
} from '@/types/translation';

interface SaheehEntry {
  t: string;
  f?: Record<string, string>;
}

interface ClearQuranEntry {
  resource_id: number;
  text: string;
}

interface ClearQuranData {
  translations: ClearQuranEntry[];
}

// Module-scope data (require() is cached by Metro — zero cost after first load)
const saheehData =
  require('@/data/SaheehInternational.translation-with-footnote-tags.json') as Record<
    string,
    SaheehEntry
  >;
const clearQuranData =
  require('@/data/clear-quran-translation.json') as ClearQuranData;

// Build verse_key → global 1-based index map for Clear Quran (keyed by sequential verse id)
// The Clear Quran translations array is 0-indexed by global verse ID (1-6236 → index 0-6235)
import type {QuranData} from '@/types/quran';
const quranData = require('@/data/quran.json') as QuranData;

const verseKeyToGlobalId: Record<string, number> = {};
for (const verse of Object.values(quranData)) {
  verseKeyToGlobalId[verse.verse_key] = verse.id;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

export function getBundledTranslation(
  verseKey: string,
  translationId: BundledTranslationId,
): string {
  if (translationId === 'saheeh') {
    return saheehData[verseKey]?.t ?? '';
  }
  const globalId = verseKeyToGlobalId[verseKey];
  if (globalId == null) return '';
  const entry = clearQuranData.translations[globalId - 1];
  return entry ? stripHtml(entry.text) : '';
}

export function getBundledTranslationRaw(
  verseKey: string,
  translationId: BundledTranslationId,
): string {
  if (translationId === 'saheeh') {
    return saheehData[verseKey]?.t ?? '';
  }
  const globalId = verseKeyToGlobalId[verseKey];
  if (globalId == null) return '';
  return clearQuranData.translations[globalId - 1]?.text ?? '';
}

export function getBundledFootnotes(
  verseKey: string,
  translationId: BundledTranslationId,
): Record<string, string> | undefined {
  if (translationId === 'saheeh') {
    return saheehData[verseKey]?.f;
  }
  // Clear Quran doesn't have structured footnotes in our data
  return undefined;
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
