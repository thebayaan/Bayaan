// Tafseer edition from Al Quran Cloud API
export interface TafseerEdition {
  identifier: string;
  language: string;
  name: string;
  englishName: string;
  authorName?: string;
  format: string;
  type: string;
  direction: 'ltr' | 'rtl';
}

// Metadata for a downloaded tafseer stored in SQLite
export interface DownloadedTafseerMeta {
  identifier: string;
  name: string;
  englishName: string;
  language: string;
  direction: 'ltr' | 'rtl';
  downloadedAt: number;
  verseCount: number;
  authorName?: string;
}
