// What a press on the Surahs screen plays: the surahs the viewer is looking
// at (a juz, the short surahs...), not the whole recitation, and listening
// progress shaped so the grid only re-renders when a bar visibly moves.

import type {Reciter, Rewayah} from '../types/reciter';
import type {ContinueEntry} from './continueListeningStore';
import {voiceForSurah, type PlayItemInput} from './playbackRouting';

/**
 * The queue for a press on `voice`'s surah while `surahNumbers` are shown:
 * those surahs in order, in the voice's recitation when it is known (the
 * ones it lacks left out), else each resolved by playOrOpen (and dropped
 * when the reciter has no recording of it). Always holds the pressed surah.
 */
export function visibleQueue(
  voice: PlayItemInput,
  surahNumbers: readonly number[],
  known: readonly Rewayah[] = [],
): PlayItemInput[] {
  const rewayah = voice.rewayahId
    ? known.find(r => r.id === voice.rewayahId)
    : undefined;
  const numbers = rewayah
    ? surahNumbers.filter(
        n => n === voice.surahNumber || rewayah.surah_list.includes(n),
      )
    : surahNumbers.slice();
  if (!numbers.includes(voice.surahNumber)) numbers.unshift(voice.surahNumber);
  return numbers.map(surahNumber => ({
    reciterId: voice.reciterId,
    rewayahId: voice.rewayahId,
    surahNumber,
  }));
}

/**
 * The first shown surah someone can play, and who: what "Play Juz 27"
 * starts with. Null when no candidate has any of them.
 */
export function firstVoice(
  candidates: readonly Reciter[],
  surahNumbers: readonly number[],
): PlayItemInput | null {
  for (const n of surahNumbers) {
    const voice = voiceForSurah(candidates, n);
    if (voice) return voice;
  }
  return null;
}

/** Progress bars move in steps of this share, so a 5 s save rarely shows. */
const PROGRESS_STEP = 0.02;

/**
 * Listening progress (0-1) per surah, the latest entry per surah, limited
 * to one reciter when given; plus a key that changes only when a bar would
 * visibly change, for memoising on.
 */
export function surahProgress(
  entries: readonly ContinueEntry[],
  reciterId?: string,
): {key: string; bySurah: Map<number, number>} {
  const bySurah = new Map<number, number>();
  // Entries are most recent first: keep the latest per surah.
  for (const e of entries) {
    if (reciterId !== undefined && e.reciterId !== reciterId) continue;
    if (bySurah.has(e.surahNumber) || e.durationSeconds <= 0) continue;
    const share = Math.min(1, e.positionSeconds / e.durationSeconds);
    bySurah.set(
      e.surahNumber,
      Math.round(share / PROGRESS_STEP) * PROGRESS_STEP,
    );
  }
  const key = Array.from(bySurah, ([n, p]) => `${n}:${p.toFixed(2)}`).join(',');
  return {key, bySurah};
}
