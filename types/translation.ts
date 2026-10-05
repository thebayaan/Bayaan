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

// Shared translation edition contract (RFC-009). Used by
// `TranslationProvider` implementations (Bayaan's alQuran.cloud-backed
// default + any fork override) and by the SQLite cache layer.
// Provider implementations are responsible for mapping their upstream
// API shape into this shape.
export interface RemoteTranslationEdition {
  identifier: string;
  language: string;
  name: string;
  englishName: string;
  format: string;
  type: string;
  direction: 'ltr' | 'rtl';
}

// A single translated verse, as returned by a TranslationProvider.
// (Moved here from TranslationApiService.ts in RFC-009 so the provider
// interface and its implementations can share the type.)
export interface TranslationVerse {
  surahNumber: number;
  ayahNumber: number;
  verseKey: string;
  text: string;
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
