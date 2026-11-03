import {create} from 'zustand';
import type {RevealedThrough} from '@/services/recitation/reveal';
import type {ShownFlag} from '@/services/recitation/flags';

/** What a memorisation take left to check, shown in a sheet after it. */
export interface RecitationSummary {
  takeId: string;
  startedAt: number;
  endedAt: number;
  /** Ayat recited, in order. */
  ayat: readonly {surah: number; ayah: number}[];
  /** Possible slips, without the ones the reader dismissed. */
  flags: readonly ShownFlag[];
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
  /** Memorisation mode: possible slips so far this take. */
  flags: readonly ShownFlag[];
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
