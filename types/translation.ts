export type BundledTranslationId = 'saheeh' | 'clear-quran';

export interface TranslationInfo {
  id: string;
  name: string;
  author: string;
  language: string;
}

export const BUNDLED_TRANSLATIONS: Record<
  BundledTranslationId,
  TranslationInfo
> = {
  saheeh: {
    id: 'saheeh',
    name: 'Saheeh International',
    author: 'Saheeh International',
    language: 'English',
  },
  'clear-quran': {
    id: 'clear-quran',
    name: 'The Clear Quran',
    author: 'Dr. Mustafa Khattab',
    language: 'English',
  },
};

// Remote translation edition from Al Quran Cloud API
export interface RemoteTranslationEdition {
  identifier: string;
  language: string;
  name: string;
  englishName: string;
  format: string;
  type: string;
  direction: 'ltr' | 'rtl';
}

// Metadata for a downloaded translation stored in SQLite
export interface DownloadedTranslationMeta {
  identifier: string;
  name: string;
  englishName: string;
  language: string;
  direction: 'ltr' | 'rtl';
  downloadedAt: number;
  verseCount: number;
}
