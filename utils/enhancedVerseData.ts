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

export interface SaheehEntry {
  t: string;
  f?: Record<string, string>;
}

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

// Track which translation is currently indexed
let currentTranslationId: string = 'saheeh';

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

// Initial build with default (saheeh)
buildBundledEnhancedVerses('saheeh');

/**
 * Rebuild the enhanced verse arrays with a different translation.
 * For bundled translations this is synchronous; for remote ones it loads from SQLite.
 * Returns true if the data was actually rebuilt (i.e., translationId changed).
 */
export async function rebuildEnhancedVerses(
  translationId: string,
): Promise<boolean> {
  if (translationId === currentTranslationId) return false;

  if (isBundledTranslation(translationId)) {
    clearActiveRemoteTranslationCache();
    buildBundledEnhancedVerses(translationId);
    return true;
  }

  // Remote translation — load all verses from SQLite into memory
  try {
    const translationMap = await translationDbService.getAllVerses(
      translationId,
    );
    if (Object.keys(translationMap).length === 0) {
      console.warn(
        `[enhancedVerseData] No verses found for ${translationId}, falling back to saheeh`,
      );
      clearActiveRemoteTranslationCache();
      buildBundledEnhancedVerses('saheeh');
      return true;
    }
    buildEnhancedVersesFromMap(translationId, translationMap);
    // Populate the sync cache so sheets can look up verses without async
    setActiveRemoteTranslationCache(translationId, translationMap);
    return true;
  } catch (error) {
    console.warn(
      `[enhancedVerseData] Failed to load remote translation ${translationId}:`,
      error,
    );
    clearActiveRemoteTranslationCache();
    buildBundledEnhancedVerses('saheeh');
    return true;
  }
}
