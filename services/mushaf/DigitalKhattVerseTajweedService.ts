import {
  digitalKhattDataService,
  BASMALLAH_TEXT,
  type DKWordInfo,
} from './DigitalKhattDataService';
import {layoutWords} from './lineWordSpans';
import {alignWordTajweed, detectWordTafkhim} from './TajweedAlignmentService';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

export interface VerseTajweedOptions {
  /** Rewayah of the rendered text. Defaults to the active mushaf rewayah. */
  rewayah?: RewayahId;
  /** The rendered word list (e.g. from useRewayahWords). Defaults to
   *  digitalKhattDataService.getVerseWords(verseKey, rewayah). */
  words?: readonly DKWordInfo[];
}

/**
 * Maps tajweed rules to character indices within a DK-encoded verse string.
 *
 * The tajweed data is the Hafs QPC set, so it is only ever painted on Hafs
 * text: for any other rewayah this returns null.
 *
 * For each verse, we:
 * 1. Take the rendered words (the caller's list, or getVerseWords) and lay
 *    them out with the shared span model, so offsets match the joined verse
 *    text exactly (blank slots skipped, multi-token slots kept whole)
 * 2. Match against indexed tajweed data by wordPositionInVerse
 * 3. Use TajweedAlignmentService to align QPC segments onto DK text
 * 4. Return Map<charIndex, ruleName>
 *
 * Results are cached per verse and dropped whenever the DK words cache
 * (digitalKhattDataService.getCacheVersion) or the tajweed data changes. A
 * verse with no words yet (data still loading) is never cached.
 */
const verseTajweedCache = new Map<string, Map<number, string> | null>();
let cacheVersion: number | null = null;
let cacheTajweedData: IndexedTajweedData | null = null;

/** Drops every cached verse map (also happens automatically on data change). */
export function clearVerseTajweedCache(): void {
  verseTajweedCache.clear();
  cacheVersion = null;
  cacheTajweedData = null;
}

export function getVerseTajweedMap(
  verseKey: string,
  indexedTajweedData: IndexedTajweedData,
  options: VerseTajweedOptions = {},
): Map<number, string> | null {
  const rewayah = options.rewayah ?? digitalKhattDataService.rewayah;
  if (rewayah !== 'hafs') return null;

  const version = digitalKhattDataService.getCacheVersion();
  if (version !== cacheVersion || indexedTajweedData !== cacheTajweedData) {
    verseTajweedCache.clear();
    cacheVersion = version;
    cacheTajweedData = indexedTajweedData;
  }

  const cached = verseTajweedCache.get(verseKey);
  if (cached !== undefined) return cached;

  const words =
    options.words ?? digitalKhattDataService.getVerseWords(verseKey, rewayah);
  const {spans} = layoutWords(words);
  if (spans.length === 0) return null;

  const tajweedWords = indexedTajweedData[verseKey];
  if (!tajweedWords) {
    verseTajweedCache.set(verseKey, null);
    return null;
  }

  const charToRule = new Map<number, string>();

  for (const span of spans) {
    const dkWord = span.item;

    // Find matching tajweed word by position in verse
    const tajweedWord = tajweedWords.find(w => {
      const pos = parseInt(w.location.split(':')[2], 10);
      return pos === dkWord.wordPositionInVerse;
    });

    // Get per-character rules: aligned QPC rules + tafkhim detection
    const wordRules = tajweedWord
      ? alignWordTajweed(span.text, tajweedWord.segments)
      : detectWordTafkhim(span.text);

    if (wordRules) {
      for (const [dkCharIdx, rule] of wordRules) {
        if (dkCharIdx < span.text.length) {
          charToRule.set(span.start + dkCharIdx, rule);
        }
      }
    }
  }

  const result = charToRule.size > 0 ? charToRule : null;
  verseTajweedCache.set(verseKey, result);
  return result;
}

/**
 * Maps tajweed rules onto the 4-word BASMALLAH_TEXT string (Hafs text).
 *
 * The basmala IS verse 1:1, so we look up tajweed data for '1:1' and
 * align the first 4 words (positions 1-4) onto the hardcoded text,
 * skipping position 5 (the verse-end marker ١).
 *
 * Result is cached — basmala tajweed never changes. Callers paint it only in
 * a Hafs context.
 */
let basmalaTajweedCache: Map<number, string> | null | undefined;

export function getBasmalaTajweedMap(
  indexedTajweedData: IndexedTajweedData,
): Map<number, string> | null {
  if (basmalaTajweedCache !== undefined) return basmalaTajweedCache;

  const tajweedWords = indexedTajweedData['1:1'];
  if (!tajweedWords) {
    basmalaTajweedCache = null;
    return null;
  }

  const basmalaWords = BASMALLAH_TEXT.split(' ');
  const charToRule = new Map<number, string>();

  let charOffset = 0;
  for (let i = 0; i < basmalaWords.length; i++) {
    const wordText = basmalaWords[i];
    const wordPosition = i + 1; // 1-based positions 1-4

    const tajweedWord = tajweedWords.find(w => {
      const pos = parseInt(w.location.split(':')[2], 10);
      return pos === wordPosition;
    });

    const wordRules = tajweedWord
      ? alignWordTajweed(wordText, tajweedWord.segments)
      : detectWordTafkhim(wordText);

    if (wordRules) {
      for (const [charIdx, rule] of wordRules) {
        charToRule.set(charOffset + charIdx, rule);
      }
    }

    charOffset += wordText.length;
    if (i < basmalaWords.length - 1) charOffset += 1;
  }

  basmalaTajweedCache = charToRule.size > 0 ? charToRule : null;
  return basmalaTajweedCache;
}
