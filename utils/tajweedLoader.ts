import {TajweedData, useTajweedStore} from '@/store/tajweedStore';

/**
 * Pre-processes a tajweed word to extract rule segments
 * This avoids expensive regex during render time
 */
interface TajweedSegment {
  text: string;
  rule: string | null;
}

interface ProcessedTajweedWord {
  word_index: number;
  location: string;
  segments: TajweedSegment[];
}

export interface ProcessedTajweedData {
  [key: string]: ProcessedTajweedWord;
}

// New indexed structure for faster verse lookup
export interface IndexedTajweedData {
  [verseKey: string]: ProcessedTajweedWord[];
}

/**
 * Process raw tajweed word by parsing out the rule segments
 */
function processTajweedWord(wordText: string): TajweedSegment[] {
  const segments: TajweedSegment[] = [];
  const ruleStack: string[] = [];
  let currentIndex = 0;

  // Regex to find opening or closing rule tags
  const tagRegex = /<rule class=([^>]+)>|<\/rule>/g;
  let match: RegExpExecArray | null;

  while (currentIndex < wordText.length) {
    // Find the next tag
    tagRegex.lastIndex = currentIndex; // Start search from current position
    match = tagRegex.exec(wordText);

    const nextTagIndex = match ? match.index : wordText.length;

    // Process text segment before the next tag (or to the end)
    if (nextTagIndex > currentIndex) {
      const textSegment = wordText.substring(currentIndex, nextTagIndex);
      const currentRule =
        ruleStack.length > 0 ? ruleStack[ruleStack.length - 1] : null;

      segments.push({
        text: textSegment,
        rule: currentRule,
      });
    }

    // If no more tags found, we're done
    if (!match) {
      break;
    }

    // Process the found tag
    if (match[1]) {
      // Opening tag: <rule class=...>
      const ruleName = match[1];
      ruleStack.push(ruleName);
      currentIndex = tagRegex.lastIndex; // Move past the opening tag
    } else {
      // Closing tag: </rule>
      ruleStack.pop();
      currentIndex = tagRegex.lastIndex; // Move past the closing tag
    }
  }

  return segments;
}

/**
 * Creates a verse-indexed lookup object from processed tajweed data
 * This allows O(1) lookup by verse key instead of O(n) filtering
 */
function createIndexedTajweedData(
  processedData: ProcessedTajweedData,
): IndexedTajweedData {
  const indexedData: IndexedTajweedData = {};

  // Group words by verse key
  Object.values(processedData).forEach(word => {
    // Extract verse key from location (e.g., from "1:1:1" get "1:1")
    const verseKey = word.location.split(':').slice(0, 2).join(':');

    if (!indexedData[verseKey]) {
      indexedData[verseKey] = [];
    }

    indexedData[verseKey].push(word);
  });

  // Sort each verse's words by word_index
  Object.keys(indexedData).forEach(verseKey => {
    indexedData[verseKey].sort((a, b) => a.word_index - b.word_index);
  });

  return indexedData;
}

/**
 * Preloads and processes tajweed data synchronously.
 * The caller is responsible for deferral (e.g. InteractionManager.runAfterInteractions).
 */
export const preloadTajweedData = (): void => {
  const {
    setTajweedData,
    setProcessedTajweedData,
    setIndexedTajweedData,
    setIsLoading,
    setError,
  } = useTajweedStore.getState();

  setIsLoading(true);
  if (__DEV__) console.log('[TajweedLoader] Starting tajweed data load...');

  try {
    const rawTajweedData =
      require('@/data/QPC Hafs Tajweed 2.json') as TajweedData;

    // Process the data to pre-parse the tajweed words
    if (__DEV__) console.log('[TajweedLoader] Pre-processing tajweed data...');
    const processed: ProcessedTajweedData = {};

    Object.entries(rawTajweedData).forEach(([key, word]) => {
      processed[key] = {
        word_index: word.word_index,
        location: word.location,
        segments: processTajweedWord(word.text),
      };
    });

    // Create indexed lookup table for O(1) verse access
    if (__DEV__) console.log('[TajweedLoader] Creating indexed lookup...');
    const indexedData = createIndexedTajweedData(processed);

    // Store all data forms
    setTajweedData(rawTajweedData);
    setProcessedTajweedData(processed);
    setIndexedTajweedData(indexedData);

    if (__DEV__)
      console.log(
        '[TajweedLoader] Tajweed data preloaded and processed successfully',
      );
  } catch (error) {
    console.error('[TajweedLoader] Error preloading tajweed data:', error);
    setError(
      error instanceof Error
        ? error.message
        : 'Unknown error loading tajweed data',
    );
  } finally {
    setIsLoading(false);
  }
};
