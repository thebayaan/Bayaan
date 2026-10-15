import {create} from 'zustand';

export type RecitationTrackingStatus =
  | 'off'
  | 'downloading'
  | 'loading'
  | 'listening'
  | 'error';

export interface RecitationTrackingState {
  status: RecitationTrackingStatus;
  /** Model download progress, 0 to 1, while status is 'downloading'. */
  downloadProgress: number;
  /** The tracker knows where the reader is; false while it searches. */
  locked: boolean;
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
}

export const RECITATION_TRACKING_IDLE: RecitationTrackingState = {
  status: 'off',
  downloadProgress: 0,
  locked: false,
  recitedVerseKeys: [],
  verseKey: null,
  wordIndex: null,
  totalWords: 0,
  error: null,
  errorKind: null,
};

/** Hafs key of the ayah the reader is reciting, or null when not listening. */
export function useRecitedVerseKey(): string | null {
  return useRecitationTrackingStore(s =>
    s.status === 'listening' ? s.verseKey : null,
  );
}

/** Written only by RecitationTrackingService; components read it. */
export const useRecitationTrackingStore = create<RecitationTrackingState>(
  () => RECITATION_TRACKING_IDLE,
);
