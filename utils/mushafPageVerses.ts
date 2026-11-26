import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {enhancedVersesBySurah, type EnhancedVerse} from './enhancedVerseData';

const surahData = require('@/data/surahData.json') as Array<{
  id: number;
  name: string;
  bismillah_pre: boolean;
}>;

export type ReadingPageItem =
  | {type: 'surah_header'; surahNumber: number; showBismillah: boolean}
  | {type: 'verse'; verse: EnhancedVerse};

// Cache results per page number (604 entries max)
const pageItemsCache = new Map<number, ReadingPageItem[]>();
// @ai-start
// The verse arrays the cached items were taken from. Applying another
// translation (rebuildEnhancedVerses) replaces every surah's array; items
// cached before that hold the old translation and are dropped. Without this
// every page already visited kept the previous translation's text.
let cachedContent: EnhancedVerse[] | undefined;
// @ai-end

export function getReadingPageItems(pageNumber: number): ReadingPageItem[] {
  // @ai-start
  if (cachedContent !== enhancedVersesBySurah[1]) {
    pageItemsCache.clear();
    cachedContent = enhancedVersesBySurah[1];
  }
  // @ai-end
  const cached = pageItemsCache.get(pageNumber);
  if (cached) return cached;

  const items: ReadingPageItem[] = [];

  // Identify which surahs have a surah_name header on this page
  const lines = digitalKhattDataService.getPageLines(pageNumber);
  const surahHeadersOnPage = new Set<number>();
  for (const line of lines) {
    if (line.line_type === 'surah_name' && line.surah_number >= 1) {
      surahHeadersOnPage.add(line.surah_number);
    }
  }

  // Get ordered verse keys for this page
  const verseKeys =
    mushafVerseMapService.getOrderedVerseKeysForPage(pageNumber);

  let lastSurahNumber = 0;

  for (const verseKey of verseKeys) {
    const [surahStr, ayahStr] = verseKey.split(':');
    const surahNumber = parseInt(surahStr, 10);
    const ayahNumber = parseInt(ayahStr, 10);

    // Insert surah header when surah changes and this page has that surah's header line
    if (
      surahNumber !== lastSurahNumber &&
      surahHeadersOnPage.has(surahNumber)
    ) {
      const surah = surahData.find(s => s.id === surahNumber);
      items.push({
        type: 'surah_header',
        surahNumber,
        showBismillah: surah?.bismillah_pre ?? false,
      });
    }
    lastSurahNumber = surahNumber;

    // Look up the enhanced verse data
    const surahVerses = enhancedVersesBySurah[surahNumber];
    if (surahVerses) {
      const verse = surahVerses.find(v => v.ayah_number === ayahNumber);
      if (verse) {
        items.push({type: 'verse', verse});
      }
    }
  }

  pageItemsCache.set(pageNumber, items);
  return items;
}
