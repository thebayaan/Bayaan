import {
  heldByAdded,
  markKey,
  type EngineWord,
  type MarkBook,
  type MarkUpdate,
  type WordMark,
} from '../wordMarks';
import type {LiveOpinion} from './types';

// The live lane of the mark book. The live check's final opinions are written straight
// in as shown mistakes, as an added mark is: the follower's rules (the confirm wait,
// the next-word ok, confusion, gop, ayah edges) were tuned on the follower, and the
// cancel step runs the same model the live check already ran. The two lanes do not
// move each other's marks: a word the follower holds is left to it, and the follower's
// later verdicts leave a live mark alone (wordMarks).

/** What the app knows that the book does not. */
export interface LiveMarkGate {
  /** The reader said they read this word correctly (its markKey). */
  dismissed: (key: string) => boolean;
  /** The word may be coloured: true unless the text is hidden and it is not shown yet. */
  revealed: (word: EngineWord & {totalWords: number}) => boolean;
  /**
   * The latest reading of this word (its markKey) the live lane already marked or
   * corrected this take. The follower may since have written its own entry over that
   * mark, and the check sends its final opinions again on later runs: none of them
   * may mark the word again.
   */
  settled?: (key: string) => number | undefined;
}

function liveMistake(opinion: LiveOpinion, now: number): WordMark {
  return {
    surah: opinion.surah,
    ayah: opinion.ayah,
    word: opinion.word,
    totalWords: opinion.totalWords,
    kind: opinion.verdict === 'missed' ? 'missed' : 'wrong',
    status: 'mistake',
    since: now,
    lastBadAt: now,
    live: {...opinion.evidence},
  };
}

/** A bad opinion may be written over this entry, or over none. */
function mayMark(mark: WordMark | undefined, opinion: LiveOpinion): boolean {
  if (!mark) return true;
  if (mark.live) {
    // The same reading again changes nothing; a later one marks a word that was
    // corrected or taken back.
    return (
      mark.status !== 'mistake' && opinion.evidence.reading > mark.live.reading
    );
  }
  if (mark.status === 'noted') return true;
  // The follower showed it and saw it read again. Only a reading after the bad
  // verdict it showed can be the new one.
  return (
    mark.status === 'corrected' &&
    mark.lastBadAudio !== undefined &&
    opinion.evidence.audioFrom > mark.lastBadAudio
  );
}

/**
 * Writes the live check's final opinions into the book. A missed or changed word
 * becomes a shown mistake at once (returned as confirmed), unless the follower holds
 * the word as a suspect, a check or a mistake, the reader dismissed it, an added mark
 * reaches it, or it is hidden and not yet revealed. A fine word read again after a
 * live mistake corrects it. Opinions that are not final move nothing, and one applied
 * again changes nothing.
 */
export function applyLiveOpinions(
  book: MarkBook,
  opinions: readonly LiveOpinion[],
  now: number,
  gate: LiveMarkGate,
): MarkUpdate {
  let next: Map<string, WordMark> | null = null;
  const confirmed: WordMark[] = [];
  const corrected: WordMark[] = [];
  for (const opinion of opinions) {
    if (!opinion.final) continue;
    const key = markKey(opinion.surah, opinion.ayah, opinion.word);
    if (gate.dismissed(key)) continue;
    const mark = (next ?? book).get(key);
    if (opinion.verdict === 'fine') {
      if (
        mark?.live &&
        mark.status === 'mistake' &&
        opinion.evidence.reading > mark.live.reading
      ) {
        const fixed: WordMark = {
          ...mark,
          status: 'corrected',
          live: {...opinion.evidence},
        };
        next ??= new Map(book);
        next.set(key, fixed);
        corrected.push(fixed);
      }
      continue;
    }
    const settled = gate.settled?.(key);
    if (settled !== undefined && opinion.evidence.reading <= settled) continue;
    if (!mayMark(mark, opinion)) continue;
    if (!gate.revealed(opinion)) continue;
    if (heldByAdded(next ?? book, opinion, now)) continue;
    const shown = liveMistake(opinion, now);
    next ??= new Map(book);
    next.set(key, shown);
    confirmed.push(shown);
  }
  return {book: next ?? book, confirmed, corrected};
}
