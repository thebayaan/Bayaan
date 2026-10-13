import {QuranData, Verse} from '@/types/quran';
import {
  getBundledTranslation,
  isBundledTranslation,
  setActiveRemoteTranslationCache,
  clearActiveRemoteTranslationCache,
} from '@/utils/translationLookup';
import type {BundledTranslationId} from '@/types/translation';
import {translationDbService} from '@/services/translation/TranslationDbService';

// Import data with type safety - loaded once at module scope
const quranData = require('@/data/quran.json') as QuranData;

export interface TransliterationVerse {
  t: string;
}

export interface TransliterationData {
  [verseKey: string]: TransliterationVerse;
}

export interface EnhancedVerse extends Verse {
  translation?: string;
  transliteration?: string;
}

const transliterationDataCache =
  require('@/data/transliteration.json') as TransliterationData;

// Pre-index verses by surah at module scope (one-time O(6236) cost, then O(1) per lookup)
const versesBySurah: Record<number, Verse[]> = {};
Object.values(quranData).forEach(verse => {
  (versesBySurah[verse.surah_number] ??= []).push(verse);
});
Object.values(versesBySurah).forEach(arr =>
  arr.sort((a, b) => a.ayah_number - b.ayah_number),
);

// The bundled edition: the default, and the fallback when a download is
// missing or unreadable.
const FALLBACK_TRANSLATION_ID: BundledTranslationId = 'clear-quran';

// Track which translation is currently indexed, and the download revision
// it was read at (an update of the same edition rebuilds too)
let currentTranslationId: string = FALLBACK_TRANSLATION_ID;
let currentRevision: number | undefined;

// Pre-build enhanced verse arrays with translations at module scope
export const enhancedVersesBySurah: Record<number, EnhancedVerse[]> = {};

function buildEnhancedVersesFromMap(
  translationId: string,
  translationMap: Record<string, string>,
) {
  for (const [surahStr, surahVerses] of Object.entries(versesBySurah)) {
    enhancedVersesBySurah[Number(surahStr)] = surahVerses.map(verse => {
      const verseKey = `${verse.surah_number}:${verse.ayah_number}`;
      return {
        ...verse,
        translation: translationMap[verseKey] ?? '',
        transliteration: transliterationDataCache?.[verseKey]?.t || '',
      };
    });
  }
  currentTranslationId = translationId;
}

function buildBundledEnhancedVerses(translationId: BundledTranslationId) {
  for (const [surahStr, surahVerses] of Object.entries(versesBySurah)) {
    enhancedVersesBySurah[Number(surahStr)] = surahVerses.map(verse => {
      const verseKey = `${verse.surah_number}:${verse.ayah_number}`;
      return {
        ...verse,
        translation: getBundledTranslation(verseKey, translationId),
        transliteration: transliterationDataCache?.[verseKey]?.t || '',
      };
    });
  }
  currentTranslationId = translationId;
}

// Initial build with the default (Clear Quran)
buildBundledEnhancedVerses(FALLBACK_TRANSLATION_ID);

// The download time of the rows read, so a later rebuild can tell whether
// content sync replaced them; undefined when unknown.
async function loadRevision(
  translationId: string,
): Promise<number | undefined> {
  try {
    const downloaded = await translationDbService.getDownloadedTranslations();
    return downloaded.find(item => item.identifier === translationId)
      ?.downloadedAt;
  } catch {
    return undefined;
  }
}

// Footnotes are optional: a failed read keeps the verses and shows no bodies.
async function loadFootnotes(
  translationId: string,
): Promise<Record<string, string>> {
  try {
    return await translationDbService.getFootnotes(translationId);
  } catch {
    return {};
  }
}

/**
 * Rebuild the enhanced verse arrays with a different translation.
 * For bundled translations this is synchronous; for remote ones it loads from SQLite.
 * `revision` (the download time of the edition) rebuilds the same edition
 * after content sync replaced its rows.
 * Returns true if the data was actually rebuilt.
 */
export async function rebuildEnhancedVerses(
  translationId: string,
  revision?: number,
): Promise<boolean> {
  if (
    translationId === currentTranslationId &&
    (revision === undefined || revision === currentRevision)
  )
    return false;
  currentRevision = undefined;

  if (isBundledTranslation(translationId)) {
    clearActiveRemoteTranslationCache();
    buildBundledEnhancedVerses(translationId);
    return true;
  }

  // Remote translation — load all verses from SQLite into memory
  try {
    const translationMap =
      await translationDbService.getAllVerses(translationId);
    if (Object.keys(translationMap).length === 0) {
      console.warn(
        `[enhancedVerseData] No verses found for ${translationId}, falling back to ${FALLBACK_TRANSLATION_ID}`,
      );
      clearActiveRemoteTranslationCache();
      buildBundledEnhancedVerses(FALLBACK_TRANSLATION_ID);
      return true;
    }
    const footnotes = await loadFootnotes(translationId);
    currentRevision = await loadRevision(translationId);
    buildEnhancedVersesFromMap(translationId, translationMap);
    // Populate the sync cache so sheets can look up verses without async
    setActiveRemoteTranslationCache(translationId, translationMap, footnotes);
    return true;
  } catch (error) {
    console.warn(
      `[enhancedVerseData] Failed to load remote translation ${translationId}:`,
      error,
    );
    clearActiveRemoteTranslationCache();
    buildBundledEnhancedVerses(FALLBACK_TRANSLATION_ID);
    return true;
  }
}
