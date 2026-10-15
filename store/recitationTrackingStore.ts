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
  /** Hafs key of the ayah being recited, once the tracker has locked on. */
  verseKey: string | null;
  /** 0-based word in Tilawa's segmentation of verseKey, or null. */
  wordIndex: number | null;
  /** Word count of verseKey in Tilawa's segmentation. */
  totalWords: number;
  error: string | null;
}

export const RECITATION_TRACKING_IDLE: RecitationTrackingState = {
  status: 'off',
  downloadProgress: 0,
  verseKey: null,
  wordIndex: null,
  totalWords: 0,
  error: null,
};

/** Written only by RecitationTrackingService; components read it. */
export const useRecitationTrackingStore = create<RecitationTrackingState>(
  () => RECITATION_TRACKING_IDLE,
);
