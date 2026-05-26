// Shared tafsir edition contract (RFC-009). Used by the static
// `AVAILABLE_TAFASEER` boot-time list, by `TafsirProvider`
// implementations (Bayaan's QF-backed default + any fork override), and
// by the SQLite cache layer. Provider implementations are responsible
// for mapping their upstream API shape into this shape.
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

// A single verse-level tafsir entry, as returned by a TafsirProvider.
// (Moved here from TafseerApiService.ts in RFC-009 so the provider
// interface and its implementations can share the type.)
//
// Verse-group semantics: when several consecutive verses share one
// tafsir text, each member carries the same `text` plus `groupVerseKey`
// / `fromAyah` / `toAyah`. Providers returning ungrouped tafsir leave
// those optional fields unset.
export interface TafseerVerse {
  surahNumber: number;
  ayahNumber: number;
  verseKey: string;
  text: string;
  groupVerseKey?: string;
  fromAyah?: number;
  toAyah?: number;
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
