import {create} from 'zustand';

export type IdentifyStatus =
  | 'idle'
  | 'downloading'
  | 'loading'
  | 'listening'
  | 'paused'
  | 'found'
  | 'notFound'
  // Listening ended by itself (the app left the foreground, other audio
  // took over) before anything was placed; the sheet offers to listen again.
  | 'stopped'
  | 'error';

/** A Hafs ayah. */
export interface IdentifiedAyah {
  surah: number;
  ayah: number;
}

/** Why identifying failed; the sheet words each one. */
export type IdentifyErrorCode =
  | 'permission'
  | 'download'
  | 'mic'
  | 'interrupted'
  | 'other';

export interface AyahIdentifyState {
  status: IdentifyStatus;
  /** Model download progress, 0 to 1, while status is 'downloading'. */
  downloadProgress: number;
  /** The mic is open: listening, or still following after a match. */
  micOn: boolean;
  /** The first ayah heard. */
  match: IdentifiedAyah | null;
  /** The ayah being recited now; moves on as the recitation goes on. */
  current: IdentifiedAyah | null;
  /** Other ayat worded exactly like `current` (Hafs keys). */
  twins: readonly string[];
  error: {code: IdentifyErrorCode; detail: string} | null;
}

export const AYAH_IDENTIFY_IDLE: AyahIdentifyState = {
  status: 'idle',
  downloadProgress: 0,
  micOn: false,
  match: null,
  current: null,
  twins: [],
  error: null,
};

/** Written only by AyahIdentifyService; the Which ayah? sheet reads it. */
export const useAyahIdentifyStore = create<AyahIdentifyState>(
  () => AYAH_IDENTIFY_IDLE,
);
