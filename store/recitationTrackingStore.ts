import {create} from 'zustand';
import type {RevealedThrough} from '@/services/recitation/reveal';
import type {ShownFlag} from '@/services/recitation/flags';
import type {MarkKind, WordMark} from '@/services/recitation/wordMarks';

/** A word the take marked, as the summary and history show it. */
export interface RecitationSummaryMark {
  surah: number;
  ayah: number;
  /** 1-based position of the word in the ayah (Hafs). */
  word: number;
  kind: MarkKind;
  /** 'corrected': recited again correctly in the same take. */
  status: 'mistake' | 'corrected';
}

/** What a memorisation take left to check, shown in a sheet after it. */
export interface RecitationSummary {
  takeId: string;
  startedAt: number;
  endedAt: number;
  /** Ayat recited, in order. */
  ayat: readonly {surah: number; ayah: number}[];
  /** Possible slips, without the ones the reader dismissed. */
  flags: readonly ShownFlag[];
  /** Words marked as mistakes, or corrected after one, in order. */
  marks: readonly RecitationSummaryMark[];
}

export type RecitationTrackingStatus =
  | 'off'
  | 'downloading'
  | 'loading'
  | 'listening'
  // A call, Siri or another app has the audio; the take resumes after.
  | 'paused'
  | 'error';

export interface RecitationTrackingState {
  status: RecitationTrackingStatus;
  /** Model download progress, 0 to 1, while status is 'downloading'. */
  downloadProgress: number;
  /** The tracker knows where the reader is; false while it searches. */
  locked: boolean;
  /** Hide and reveal: words up to here are shown, null before any. */
  revealedThrough: RevealedThrough | null;
  /** Hafs keys Tilawa counted as recited this take, in order. */
  recitedVerseKeys: readonly string[];
  /** Hafs key of the ayah being recited, once the tracker has locked on. */
  verseKey: string | null;
  /** 0-based word in Tilawa's segmentation of verseKey, or null. */
  wordIndex: number | null;
  /** Word count of verseKey in Tilawa's segmentation. */
  totalWords: number;
  error: string | null;
  /** 'permission' when the reader has to allow the mic in Settings. */
  errorKind: 'permission' | 'other' | null;
  /** Possible slips so far this take (skipped and look-alike ayat). */
  flags: readonly ShownFlag[];
  /** Live word marks so far: mistakes, and mistakes since corrected. */
  marks: readonly WordMark[];
  /** Set when a memorisation take ends; the mushaf shows it, then clears. */
  summary: RecitationSummary | null;
}

export const RECITATION_TRACKING_IDLE: RecitationTrackingState = {
  status: 'off',
  downloadProgress: 0,
  locked: false,
  recitedVerseKeys: [],
  revealedThrough: null,
  verseKey: null,
  wordIndex: null,
  totalWords: 0,
  error: null,
  errorKind: null,
  flags: [],
  marks: [],
  summary: null,
};

/** A take is in progress: listening, or paused by an interruption. */
export function isTakeActive(status: RecitationTrackingStatus): boolean {
  return status === 'listening' || status === 'paused';
}

/** Hafs key of the ayah the reader is reciting, or null when no take runs. */
export function useRecitedVerseKey(): string | null {
  return useRecitationTrackingStore(s =>
    isTakeActive(s.status) ? s.verseKey : null,
  );
}

/** Written only by RecitationTrackingService; components read it. */
export const useRecitationTrackingStore = create<RecitationTrackingState>(
  () => RECITATION_TRACKING_IDLE,
);
