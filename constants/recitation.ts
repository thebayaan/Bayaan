import {SECOND_LOOK_ENABLED} from '@/services/recitation/secondLook/config';

/** The recognition model and the phoneme corpus, as the UI states them. */
export const RECITATION_FOLLOWER_MB = 75;

/** Those and the second look's model together, as the UI states them. */
export const RECITATION_DOWNLOAD_MB = SECOND_LOOK_ENABLED
  ? 111
  : RECITATION_FOLLOWER_MB;
