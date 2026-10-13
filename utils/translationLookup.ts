import {
  BUNDLED_TRANSLATIONS,
  type BundledTranslationId,
} from '@/types/translation';
import {tafseerHtmlToPlainText} from '@/utils/tafseerHtmlParser';
import {stripFootnoteMarkers, stripHtml} from '@/utils/translationText';

export {
  stripFootnoteMarkers,
  translationPlainText,
} from '@/utils/translationText';

interface ClearQuranEntry {
  resource_id: number;
  text: string;
}

interface ClearQuranData {
  translations: ClearQuranEntry[];
}

// Module-scope data (require() is cached by Metro, zero cost after first load)
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

// Clear Quran's markers have no bodies to show, so the marker and its digit go.
export function getBundledTranslation(
  verseKey: string,
  _translationId: BundledTranslationId,
): string {
  const globalId = verseKeyToGlobalId[verseKey];
  if (globalId == null) return '';
  const entry = clearQuranData.translations[globalId - 1];
  return entry ? stripHtml(stripFootnoteMarkers(entry.text)) : '';
}

export function getBundledTranslationRaw(
  verseKey: string,
  _translationId: BundledTranslationId,
): string {
  const globalId = verseKeyToGlobalId[verseKey];
  if (globalId == null) return '';
  const text = clearQuranData.translations[globalId - 1]?.text;
  return text ? stripFootnoteMarkers(text) : '';
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
  footnotes: Record<string, string>;
} | null = null;

export function setActiveRemoteTranslationCache(
  id: string,
  data: Record<string, string>,
  footnotes: Record<string, string> = {},
): void {
  activeRemoteTranslationCache = {id, data, footnotes};
}

/**
 * A downloaded edition's footnote as plain text with paragraph breaks, or
 * undefined when the active cache holds another edition or no such footnote.
 */
export function getRemoteFootnote(
  translationId: string,
  footnoteId: string,
): string | undefined {
  if (activeRemoteTranslationCache?.id !== translationId) return undefined;
  const html = activeRemoteTranslationCache.footnotes[footnoteId];
  return html === undefined ? undefined : tafseerHtmlToPlainText(html);
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
