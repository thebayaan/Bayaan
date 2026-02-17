export interface Theme {
  theme: string;
  keywords: string;
  ayahFrom: number;
  ayahTo: number;
  totalAyahs: number;
}

export interface SimilarAyah {
  matchedVerseKey: string;
  matchedWordsCount: number;
  coverage: number;
  score: number;
  matchWordsRange: number[][];
}

export interface MutashabihatMatch {
  verseKey: string;
  wordRanges: [number, number][];
}

export interface MutashabihatPhrase {
  phraseId: number;
  sourceVerse: string;
  sourceWordRange: [number, number];
  totalOccurrences: number;
  matches: MutashabihatMatch[];
}
