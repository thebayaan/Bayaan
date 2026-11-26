import {SECOND_LOOK_ENABLED} from '@/services/recitation/secondLook/config';

/** The recognition model and the phoneme corpus, as the UI states them. */
export const RECITATION_FOLLOWER_MB = 75;

/** Those and the second look's model together, as the UI states them. */
export const RECITATION_DOWNLOAD_MB = SECOND_LOOK_ENABLED
  ? 111
  : RECITATION_FOLLOWER_MB;

/** Tilawa 1.0's model and reference, as the UI states them (v1/assets V1_DOWNLOAD_MB). */
export const RECITATION_V1_FOLLOWER_MB = 72;

/** Those and the second look's model, which Tilawa 1.0 cannot do without. */
export const RECITATION_V1_DOWNLOAD_MB =
  RECITATION_V1_FOLLOWER_MB + (RECITATION_DOWNLOAD_MB - RECITATION_FOLLOWER_MB);

/** What follow-along downloads with this follower, as the UI states it. */
export function recitationDownloadMb(choice: 'v0' | 'v1'): number {
  return choice === 'v1' ? RECITATION_V1_DOWNLOAD_MB : RECITATION_DOWNLOAD_MB;
}
