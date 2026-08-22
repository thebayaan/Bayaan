export type HighlightColor = 'yellow' | 'green' | 'blue' | 'orange' | 'purple';

export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: 'rgba(255, 243, 176, 0.3)',
  green: 'rgba(184, 240, 192, 0.3)',
  blue: 'rgba(176, 212, 255, 0.3)',
  orange: 'rgba(255, 212, 176, 0.3)',
  purple: 'rgba(212, 176, 255, 0.3)',
};

// @ai — persistent tint for bookmarked verses in the mushaf renderers.
// Bookmarking previously left no visible trace on the page (the momentary
// highlight users saw was the selection layer clearing when the action
// sheet closed). An explicit colored highlight overrides this tint.
//
// Deliberately its OWN token, NOT one of HIGHLIGHT_COLORS: reusing `yellow`
// made a bookmarked-only verse pixel-identical to an explicitly
// yellow-highlighted one (review finding 4). Teal sits outside the five
// user-selectable highlight hues (yellow/green/blue/orange/purple) so a
// bookmark stays distinguishable from every highlight.
export const BOOKMARK_HIGHLIGHT_COLOR = 'rgba(64, 190, 190, 0.34)';

// Optional rewayah this annotation was saved in. Null on legacy rows
// written before rewayah stamping was introduced — the UI treats those
// as rewayah-agnostic and opens them in whatever is currently active.
import type {RewayahId} from '@/store/mushafSettingsStore';

export interface VerseBookmark {
  id: string;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  createdAt: number;
  rewayahId?: RewayahId;
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
  rewayahId?: RewayahId;
}

export interface VerseHighlight {
  id: string;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  color: HighlightColor;
  createdAt: number;
  rewayahId?: RewayahId;
}
