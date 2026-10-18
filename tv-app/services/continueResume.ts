import {getContinueListening} from './continueListeningStore';
import {playOrOpen} from './playbackRouting';

/**
 * Resumes the newest Continue listening entry where it stopped, opening the
 * player: what the sidebar's now-playing tile offers while the player is
 * empty, and what Play/Pause does then (after a relaunch, say). False when
 * there is nothing to resume.
 */
export function resumeNewestContinue(source: string): boolean {
  const newest = getContinueListening()[0];
  if (!newest) return false;
  void playOrOpen({
    reciterId: newest.reciterId,
    rewayahId: newest.rewayahId || undefined,
    surahNumber: newest.surahNumber,
    startSeconds: newest.positionSeconds,
    source,
  });
  return true;
}
