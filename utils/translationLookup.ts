import {
  BUNDLED_TRANSLATIONS,
  type BundledTranslationId,
} from '@/types/translation';
import {DEFAULT_TRANSLATION_ID} from '@/services/translation/translationRemap';
import {htmlToPlainText} from '@/utils/tafseerHtmlParser';
import {
  stripFootnoteMarkers,
  stripHtml,
  translationPlainText,
} from '@/utils/translationText';

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

/**
 * The name of the edition a verse view actually shows: the selection's when
 * its text is loaded, otherwise the bundled fallback's
 * (getEffectiveTranslationId).
 */
export function getRenderedTranslationName(
  selectedTranslationId: string | undefined,
): string {
  return getTranslationName(getEffectiveTranslationId(selectedTranslationId));
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
  return html === undefined ? undefined : htmlToPlainText(html);
}

/**
 * A footnote's body as plain text, from the downloaded edition's cache;
 * undefined when it is not available. The bundled Clear Quran has none.
 */
export function getFootnoteText(
  translationId: string,
  footnoteId: string,
): string | undefined {
  return isBundledTranslation(translationId)
    ? undefined
    : getRemoteFootnote(translationId, footnoteId);
}

export function clearActiveRemoteTranslationCache(): void {
  activeRemoteTranslationCache = null;
}

/**
 * The edition whose text is on screen for a selection: the selection itself
 * when it is bundled or its downloaded text is loaded (enhancedVerseData
 * fills the cache), otherwise the bundled fallback. A selection that is not
 * installed yet (QF 20 replacing the retired bundled Saheeh), or whose
 * download failed to load, renders the fallback; every label and text lookup
 * resolves through here so they always name and show the same edition.
 */
export function getEffectiveTranslationId(
  selectedTranslationId: string | undefined,
): string {
  if (selectedTranslationId === undefined) return DEFAULT_TRANSLATION_ID;
  if (isBundledTranslation(selectedTranslationId)) return selectedTranslationId;
  if (activeRemoteTranslationCache?.id === selectedTranslationId)
    return selectedTranslationId;
  return DEFAULT_TRANSLATION_ID;
}

/**
 * The text shown for a verse, as markup (QF inline HTML, footnote markers
 * kept for a download; the bundled edition's markers are stripped), read
 * from the effective edition of the selection.
 */
export function getTranslationMarkup(
  verseKey: string,
  selectedTranslationId: string | undefined,
): string {
  return getTranslationTextRaw(
    verseKey,
    getEffectiveTranslationId(selectedTranslationId),
  );
}

/**
 * The text shown for a verse as plain text (copy, share, previews), read
 * from the effective edition of the selection.
 */
export function getTranslationPlainText(
  verseKey: string,
  selectedTranslationId: string | undefined,
): string {
  return translationPlainText(
    getTranslationMarkup(verseKey, selectedTranslationId),
  );
}

/**
 * The text of exactly this edition: '' when a remote edition is not the one
 * loaded. Displays use getTranslationPlainText / getTranslationMarkup, which
 * fall back to the edition actually shown.
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
 * Exact-edition lookup as getTranslationText, without HTML stripping.
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
