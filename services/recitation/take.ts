import type {
  CorrectionIssue,
  ExpectedPassage,
  WorkerOutbound,
} from '@tilawa/core';
import type {RecitationStopReason} from '@/services/analytics/events';
import type {SessionPurpose} from './activeSession';
import type {EngineMessage} from './recitationEngine';

// One take as events, never audio: the ayat recited, where the reader
// hesitated, what they peeked at, and anything the engine flagged. Pure
// functions over engine messages, so a take can be rebuilt in tests.

/** A pause this long before the next word of the same ayah is a stall. */
export const STALL_MS = 3000;
/** Longer pauses are breaks (the phone was put down), not stalls. */
export const STALL_MAX_MS = 20_000;

export interface TakeAyah {
  surah: number;
  ayah: number;
  confidence: number | null;
}

export interface TakeFlag {
  kind: CorrectionIssue['kind'];
  surah: number;
  ayah: number;
  word: number;
  /** Which check raised it: a structural rule or the word rules. */
  source: 'ayah_order' | 'similar_verse' | 'word';
}

export interface TakePeek {
  surah: number;
  ayah: number;
  kind: 'word' | 'ayah';
  at: number;
}

export interface TakeStall {
  surah: number;
  ayah: number;
  /** 0-based word in Tilawa's segmentation: the word after the pause. */
  wordIndex: number;
  ms: number;
  at: number;
}

/**
 * How the engine judged one word of the take. `word` is the word's 1-based
 * position in the ayah (Hafs, as the mushaf numbers it).
 */
export interface TakeWord {
  surah: number;
  ayah: number;
  word: number;
  /** 'unclear': the engine could not tell, or the mark never held. */
  result: 'correct' | 'unclear' | 'mistake' | 'corrected';
  /** For a mistake, or a corrected one: missed, or something else said. */
  kind: 'missed' | 'wrong' | null;
  /** The page text was hidden when the word was judged. */
  hidden: boolean;
  /** When the word was last judged (ms). */
  at: number;
}

export interface TakeRecord {
  id: string;
  purpose: SessionPurpose;
  startedAt: number;
  endedAt: number;
  /** The page text was hidden (memorisation) when the take started. */
  hidden: boolean;
  expected: ExpectedPassage | null;
  stopReason: RecitationStopReason;
  ayat: TakeAyah[];
  flags: TakeFlag[];
  peeks: TakePeek[];
  stalls: TakeStall[];
  /** Every judged word. Absent on takes saved before word results. */
  words?: TakeWord[];
}

interface Cursor {
  surah: number;
  ayah: number;
  wordIndex: number;
  totalWords: number;
  /** When the cursor last moved. */
  at: number;
}

export interface TakeBuilder {
  readonly id: string;
  readonly purpose: SessionPurpose;
  readonly startedAt: number;
  readonly hidden: boolean;
  readonly expected: ExpectedPassage | null;
  readonly matched: readonly TakeAyah[];
  readonly flags: readonly TakeFlag[];
  readonly peeks: readonly TakePeek[];
  readonly stalls: readonly TakeStall[];
  readonly cursor: Cursor | null;
}

export function startTake(init: {
  id: string;
  purpose: SessionPurpose;
  startedAt: number;
  hidden: boolean;
  expected: ExpectedPassage | null;
}): TakeBuilder {
  return {
    ...init,
    matched: [],
    flags: [],
    peeks: [],
    stalls: [],
    cursor: null,
  };
}

function sameAyah(
  a: {surah: number; ayah: number},
  b: {surah: number; ayah: number},
): boolean {
  return a.surah === b.surah && a.ayah === b.ayah;
}

function moveCursor(b: TakeBuilder, next: Cursor): TakeBuilder {
  const cur = b.cursor;
  if (!cur) return {...b, cursor: next};
  if (sameAyah(cur, next) && cur.wordIndex === next.wordIndex) return b;
  const gap = next.at - cur.at;
  const stalled =
    sameAyah(cur, next) &&
    next.wordIndex > cur.wordIndex &&
    cur.wordIndex < cur.totalWords - 1 &&
    gap >= STALL_MS &&
    gap <= STALL_MAX_MS;
  if (!stalled) return {...b, cursor: next};
  const stall: TakeStall = {
    surah: next.surah,
    ayah: next.ayah,
    wordIndex: cur.wordIndex + 1,
    ms: gap,
    at: next.at,
  };
  return {...b, cursor: next, stalls: [...b.stalls, stall]};
}

function addFlag(b: TakeBuilder, issue: CorrectionIssue): TakeBuilder {
  const flag: TakeFlag = {
    kind: issue.kind,
    surah: issue.surah,
    ayah: issue.ayah,
    word: issue.word,
    source: issue.source ?? 'word',
  };
  const seen = b.flags.some(
    f =>
      f.kind === flag.kind &&
      f.surah === flag.surah &&
      f.ayah === flag.ayah &&
      f.word === flag.word,
  );
  return seen ? b : {...b, flags: [...b.flags, flag]};
}

export function takeEvent(
  b: TakeBuilder,
  msg: EngineMessage,
  now: number,
): TakeBuilder {
  switch (msg.type) {
    case 'verse_match':
      if (b.matched.some(a => sameAyah(a, msg))) return b;
      return {
        ...b,
        matched: [
          ...b.matched,
          {surah: msg.surah, ayah: msg.ayah, confidence: msg.confidence},
        ],
      };
    case 'word_progress':
      return moveCursor(b, {
        surah: msg.surah,
        ayah: msg.ayah,
        wordIndex: msg.word_index,
        totalWords: msg.total_words,
        at: now,
      });
    case 'correction':
      if (msg.state.phase !== 'error' || !msg.state.issue) return b;
      return addFlag(b, msg.state.issue);
    default:
      return b;
  }
}

export function takePeek(b: TakeBuilder, peek: TakePeek): TakeBuilder {
  return {...b, peeks: [...b.peeks, peek]};
}

/**
 * The finished take. `finalMessages` are what the engine emitted while
 * flushing: its final_sequence is the most complete list of ayat, and the
 * structural rules raise their flags there.
 */
export function finishTake(
  b: TakeBuilder,
  finalMessages: readonly WorkerOutbound[],
  reason: RecitationStopReason,
  now: number,
): TakeRecord {
  const done = finalMessages.reduce((acc, msg) => takeEvent(acc, msg, now), b);
  let final: TakeAyah[] | null = null;
  for (const msg of finalMessages) {
    if (msg.type === 'final_sequence') {
      final = msg.verses.map(v => ({
        surah: v.surah,
        ayah: v.ayah,
        confidence: v.confidence,
      }));
    }
  }
  return {
    id: done.id,
    purpose: done.purpose,
    startedAt: done.startedAt,
    endedAt: now,
    hidden: done.hidden,
    expected: done.expected,
    stopReason: reason,
    ayat: final ?? [...done.matched],
    flags: [...done.flags],
    peeks: [...done.peeks],
    stalls: [...done.stalls],
  };
}
