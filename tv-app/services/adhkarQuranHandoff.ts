// The Quran and the adhkar reader share one player (audioFocus.ts): an adhkar
// recitation pauses the Quran. A visit to the reader hands the Quran back as
// it found it, so listening never ends silently because a list was opened.

type Deps = {
  /** The Quran player's status now ('playing', 'paused', ...). */
  quranStatus: () => string;
  /** Plays the Quran again from where it stopped. */
  resumeQuran: () => void;
};

export type QuranHandoff = {
  /** The Quran was playing as the reader opened. */
  readonly wasPlaying: boolean;
  /** An adhkar recitation started (which pauses the Quran). */
  adhkarPlayed: () => void;
  /** A recitation here paused the Quran: leaving will resume it. */
  tookOver: () => boolean;
  /**
   * Leaving the reader: resumes the Quran when a recitation here paused it
   * and nothing else has changed it since. True when it resumed.
   */
  leave: () => boolean;
};

export function createQuranHandoff({
  quranStatus,
  resumeQuran,
}: Deps): QuranHandoff {
  const wasPlaying = quranStatus() === 'playing';
  let tookOver = false;
  let left = false;
  return {
    wasPlaying,
    adhkarPlayed: () => {
      if (wasPlaying) tookOver = true;
    },
    tookOver: () => tookOver,
    leave: () => {
      if (left) return false;
      left = true;
      if (!wasPlaying || !tookOver || quranStatus() !== 'paused') return false;
      resumeQuran();
      return true;
    },
  };
}
