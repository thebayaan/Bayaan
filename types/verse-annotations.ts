export type HighlightColor = 'yellow' | 'green' | 'blue' | 'orange' | 'purple';

export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: '#FFF3B0',
  green: '#B8F0C0',
  blue: '#B0D4FF',
  orange: '#FFD4B0',
  purple: '#D4B0FF',
};

export interface VerseBookmark {
  id: string;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  createdAt: number;
}

export interface VerseNote {
  id: string;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  content: string;
  verseKeys?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface VerseHighlight {
  id: string;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  color: HighlightColor;
  createdAt: number;
}
