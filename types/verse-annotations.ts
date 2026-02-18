export type HighlightColor = 'yellow' | 'green' | 'blue' | 'orange' | 'purple';

export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: 'rgba(255, 243, 176, 0.3)',
  green: 'rgba(184, 240, 192, 0.3)',
  blue: 'rgba(176, 212, 255, 0.3)',
  orange: 'rgba(255, 212, 176, 0.3)',
  purple: 'rgba(212, 176, 255, 0.3)',
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
