import {mushafVerseMapService} from './MushafVerseMapService';

const quranThemes = require('@/data/quran-themes.json');

export interface VerseThemeInfo {
  theme: string;
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  verseKeyFrom: string;
  verseKeyTo: string;
  themeIndex: number; // sequential index within surah (0-based), for zebra striping
}

interface RawThemeEntry {
  theme: string;
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  verseKeyFrom: string;
  verseKeyTo: string;
  totalAyahs: number;
  keywords?: string[];
}

export interface PageThemeInfo {
  theme: VerseThemeInfo;
  verseKeys: string[];
}

class ThemeDataService {
  private verseMap: Map<string, VerseThemeInfo> = new Map();
  private initialized = false;

  init(): void {
    if (this.initialized) return;

    const themes: RawThemeEntry[] = quranThemes.themes;
    let currentSurah = -1;
    let themeIndex = 0;

    for (const entry of themes) {
      // Reset themeIndex when surah changes
      if (entry.surah !== currentSurah) {
        currentSurah = entry.surah;
        themeIndex = 0;
      } else {
        themeIndex++;
      }

      const info: VerseThemeInfo = {
        theme: entry.theme,
        surah: entry.surah,
        ayahFrom: entry.ayahFrom,
        ayahTo: entry.ayahTo,
        verseKeyFrom: entry.verseKeyFrom,
        verseKeyTo: entry.verseKeyTo,
        themeIndex,
      };

      // Map every verse in the range to this theme info
      for (let ayah = entry.ayahFrom; ayah <= entry.ayahTo; ayah++) {
        this.verseMap.set(`${entry.surah}:${ayah}`, info);
      }
    }

    this.initialized = true;
  }

  getThemeForVerse(verseKey: string): VerseThemeInfo | undefined {
    if (!this.initialized) this.init();
    return this.verseMap.get(verseKey);
  }

  getThemesForPage(pageNumber: number): PageThemeInfo[] {
    if (!this.initialized) this.init();
    const verseKeys =
      mushafVerseMapService.getOrderedVerseKeysForPage(pageNumber);
    const result: PageThemeInfo[] = [];
    const seenThemeKeys = new Set<string>();

    for (const verseKey of verseKeys) {
      const themeInfo = this.verseMap.get(verseKey);
      if (!themeInfo) continue;

      // Use verseKeyFrom as unique identifier for each theme range
      const themeKey = themeInfo.verseKeyFrom;
      if (seenThemeKeys.has(themeKey)) {
        // Add verse key to existing entry
        const existing = result.find(r => r.theme.verseKeyFrom === themeKey);
        if (existing) {
          existing.verseKeys.push(verseKey);
        }
      } else {
        seenThemeKeys.add(themeKey);
        result.push({
          theme: themeInfo,
          verseKeys: [verseKey],
        });
      }
    }

    return result;
  }
}

export const themeDataService = new ThemeDataService();
