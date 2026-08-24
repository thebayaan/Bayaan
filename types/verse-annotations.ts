export type HighlightColor = 'yellow' | 'green' | 'blue' | 'orange' | 'purple';
export type AnnotationOwnerScope = 'guest' | `qf:${string}`;

export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: 'rgba(255, 243, 176, 0.3)',
  green: 'rgba(184, 240, 192, 0.3)',
  blue: 'rgba(176, 212, 255, 0.3)',
  orange: 'rgba(255, 212, 176, 0.3)',
  purple: 'rgba(212, 176, 255, 0.3)',
};

// Optional rewayah this annotation was saved in. Null on legacy rows
// written before rewayah stamping was introduced — the UI treats those
// as rewayah-agnostic and opens them in whatever is currently active.
import type {RewayahId} from '@/store/mushafSettingsStore';

export interface VerseBookmark {
  id: string;
  ownerScope?: AnnotationOwnerScope;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  createdAt: number;
  rewayahId?: RewayahId;
  remoteId?: string;
  serverCreatedAt?: number;
  serverUpdatedAt?: number;
}

export interface VerseNote {
  id: string;
  ownerScope?: AnnotationOwnerScope;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  content: string;
  verseKeys?: string[];
  createdAt: number;
  updatedAt: number;
  rewayahId?: RewayahId;
  remoteId?: string;
  serverCreatedAt?: number;
  serverUpdatedAt?: number;
}

export interface VerseHighlight {
  id: string;
  ownerScope?: AnnotationOwnerScope;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  color: HighlightColor;
  createdAt: number;
  rewayahId?: RewayahId;
  remoteId?: string;
  serverCreatedAt?: number;
  serverUpdatedAt?: number;
}
