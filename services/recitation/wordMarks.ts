// Live mistake marks from the engine's per-word verdicts.
//
// The engine judges each word about 1.2 s after it is said (pending, then
// ok, unsure, wrong or skipped). A wrong or skipped word is first a suspect;
// it becomes a shown mistake only if it is still bad MARK_CONFIRM_MS later,
// which drops the one-chunk (480 ms) flickers measured on real recitations. A mistake
// whose word is later recited correctly becomes corrected. On an ayah's first
// or last word only a skip counts: "wrong" there is mostly the reciter
// joining two ayat.
//
// Three more findings feed these rules. The engine's junction check says an
// ayah's last word was left out: shown at once, and neither the second judge nor
// the second look may take it back. The second judge's answer comes about a
// second after the verdict that woke it (applyJudgeAnswer). The added-word mark
// sits in the gap before a word; it needs no model, shows at once, and clears the
// recent red on the two words around it, since an extra word is what bent them.
//
// Numbers tuned on the follower's output live in followerConstants.npl.json.
import followerConstants from './followerConstants.npl.json';

const {marks: TUNED} = followerConstants;

export type VerdictState = 'ok' | 'unsure' | 'wrong' | 'skipped' | 'pending';

/** The engine's scores behind a bad verdict (Tilawa's WordVerdict). */
export interface VerdictDetail {
  /**
   * Per-token log-likelihood ratio of the best path forced to the expected
   * word against the free best path over the word's audio: about 0 when the
   * expected word fits the audio, strongly negative when it does not.
   * Correction mode, interior words with both neighbours heard.
   */
  gop?: number | null;
  /** Share of the word's expected sounds that were heard. */
  heardRatio?: number | null;
  /** Normalised distance between the heard and expected sounds. */
  distance?: number | null;
  /**
   * The engine's junction check on an ayah's last word: true when the word was
   * left out, false on a skipped verdict when it was said after all.
   */
  junctionMissing?: boolean | null;
}

/**
 * Sounds heard between two words that look like a word of their own. The sounds
 * themselves stay in the engine: they are not Quran text, and nothing keeps them.
 */
export interface AddedBefore {
  /** How many, lengthened sounds counted once. */
  sounds: number;
  /** How badly the two words fit the audio with nothing between them. */
  noGap: number;
  /** The word before the extra sounds. */
  left: EngineWord;
}

/** One word's new verdict, in Tilawa's word index (0-based). */
export interface VerdictChange {
  surah: number;
  ayah: number;
  word: number;
  /** Words in the ayah, in Tilawa's segmentation. */
  totalWords: number;
  state: VerdictState;
  /** Present on every judged verdict. */
  detail?: VerdictDetail;
  /**
   * The state is not new: this change only carries news about the word, its
   * junction result or addedBefore. No verdict to act on, no judge to wake.
   */
  repeat?: boolean;
  /** Extra sounds were heard just before this word. */
  addedBefore?: AddedBefore;
}

/** A word of the Quran, as the engine numbers it (word 0-based). */
export interface EngineWord {
  surah: number;
  ayah: number;
  word: number;
}

/**
 * 'missed': the word was not heard. 'wrong': something else was heard.
 * 'added': extra sounds were heard in the gap just before the word; the word
 * itself was read correctly.
 */
export type MarkKind = 'missed' | 'wrong' | 'added';
/**
 * 'noted': a bad verdict that is not a slip on its own (an ayah-edge
 * 'wrong', a word that fits the audio, a suspect that flipped back or was
 * dropped). Never shown; it counts towards the confusion rule.
 * 'checking': would be a mistake, and is waiting for the second look (see
 * secondLook/config). Not shown yet, and not confirmed again.
 */
export type MarkStatus =
  | 'suspect'
  | 'checking'
  | 'mistake'
  | 'corrected'
  | 'noted';

export interface WordMark {
  surah: number;
  ayah: number;
  word: number;
  totalWords: number;
  kind: MarkKind;
  status: MarkStatus;
  /** When the word was first suspected (ms). */
  since: number;
  /** A suspect: when one of the next words was heard correctly (ms). */
  followedAt?: number;
  /** When the word last went wrong or skipped (ms). */
  lastBadAt?: number;
  /**
   * The same in audio time: seconds of the take's fed audio at the end of the
   * chunk behind that verdict.
   */
  lastBadAudio?: number;
  /** While checking: the second look it is waiting for. */
  checkId?: number;
  /** Found by the junction check: the judge and the second look leave it alone. */
  junction?: boolean;
  /** A suspect the second judge may still answer for is not shown before this. */
  judgeUntil?: number;
  /**
   * The second judge has held it back, or raised it late. The confusion rule then
   * looks no further than the time it would have fallen due with no judge.
   */
  judgeHeld?: boolean;
  /**
   * The second judge said, since the word became a suspect, that another word stood
   * here or none did. At its Step 2 the cancel step leaves such a mark alone.
   */
  identified?: boolean;
}

export type MarkBook = ReadonlyMap<string, WordMark>;

export interface MarkUpdate {
  book: MarkBook;
  /** Marks that just became mistakes. */
  confirmed: WordMark[];
  /** Mistakes that were just recited correctly. */
  corrected: WordMark[];
}

/** A bad verdict must hold this long before it is shown. */
export const MARK_CONFIRM_MS = TUNED.confirmMs;
/**
 * And one of the next NEXT_OK_WORDS words must be heard correctly within
 * this long of it, or it is dropped. With other voices in the room most
 * false marks came with more confusion right after them, while a real slip
 * is followed by the reader carrying on: on the bench this kept two thirds
 * of those false marks off the page, with clean recitation unchanged and
 * marks no later.
 */
export const NEXT_OK_WINDOW_MS = TUNED.nextOkWindowMs;
const NEXT_OK_WORDS = TUNED.nextOkWords;
/**
 * How long a suspect waits for the second judge's answer: its hold (480 ms), the wait
 * for a chunk that is late (480 ms) and its time limit (2000 ms), and a little, since
 * the judge answers at its limit whatever happens.
 */
export const JUDGE_WAIT_MS = 3000;
/** How long a verdict is remembered for an answer that comes after it. */
const SEEN_KEEP_MS = NEXT_OK_WINDOW_MS + JUDGE_WAIT_MS;
/**
 * How far an added mark reaches, either way in time: as long as a suspect can live.
 * Red older or newer than this comes from something else, such as a later reading of
 * the same words.
 */
export const ADDED_HOLD_MS = NEXT_OK_WINDOW_MS + JUDGE_WAIT_MS;

// The engine's scores, measured on 135 bench recitations (9 reciters, 5
// surahs, 852 planted mistakes) and checked with each reciter held out:
// together with the confusion rule and dropping suspects when the engine
// loses the reader, these removed 59% of false marks for 5% of real catches.
/** A skip whose expected word still fits the audio this well is the
 *  alignment slipping, not the reader. */
export const SKIP_FITS_GOP = TUNED.skipFitsGop;
/** Same for a wrong word, which needs a closer fit to be let off. */
export const WRONG_FITS_GOP = TUNED.wrongFitsGop;
/** An ayah's first word (no fit score there) judged skipped though more
 *  than this share of it was heard. */
export const FIRST_SKIP_HEARD = TUNED.firstSkipHeard;
/** A suspect with this many other words around it gone bad at the same
 *  time is confusion (noise, the tracker slipping), not a slip. */
export const CONFUSED_NEIGHBOURS = TUNED.confusedNeighbours;
const NEIGHBOUR_SPAN = TUNED.neighbourSpan;
const NEIGHBOUR_WINDOW_MS = TUNED.neighbourWindowMs;

/** `change` is one of the next NEXT_OK_WORDS words after `mark`. */
function follows(
  mark: EngineWord & {totalWords: number},
  change: EngineWord,
): boolean {
  if (change.surah !== mark.surah) return false;
  for (let i = 1; i <= NEXT_OK_WORDS; i++) {
    const word = mark.word + i;
    if (word < mark.totalWords) {
      if (change.ayah === mark.ayah && change.word === word) return true;
    } else if (
      change.ayah === mark.ayah + 1 &&
      change.word === word - mark.totalWords
    ) {
      return true;
    }
  }
  return false;
}

export function markKey(surah: number, ayah: number, word: number): string {
  return `${surah}:${ayah}:${word}`;
}

/** An added mark's key, so one word can hold a red mark and an added mark. */
export function addedKey(word: EngineWord): string {
  return `${markKey(word.surah, word.ayah, word.word)}+`;
}

/** The key a mark sits under in the book. */
export function wordMarkKey(mark: WordMark): string {
  return mark.kind === 'added'
    ? addedKey(mark)
    : markKey(mark.surah, mark.ayah, mark.word);
}

/** Junction and added marks are shown as they are, with no second look. */
export function skipsSecondLook(mark: WordMark): boolean {
  return mark.junction === true || mark.kind === 'added';
}

export function emptyMarkBook(): MarkBook {
  return new Map();
}

function isBoundary(change: VerdictChange): boolean {
  return change.word <= 0 || change.word >= change.totalWords - 1;
}

function isBad(change: VerdictChange): boolean {
  return change.state === 'wrong' || change.state === 'skipped';
}

function withoutAdded(change: VerdictChange): VerdictChange {
  if (!change.addedBefore) return change;
  const rest = {...change};
  delete rest.addedBefore;
  return rest;
}

/**
 * Drops the bad verdicts of the chunk where the engine found the reader
 * (`lock`, the word it locked or relocated onto): the whole chunk was judged
 * from the audio it replayed to find them. The lock word may have been heard
 * only from its middle, and the words before it were not heard in this lock
 * at all. The words after it go too: on the bench that cost no catch, and
 * with babble 5 dB under the reader it kept 23 of 301 false marks off the
 * page. Other verdicts pass through.
 */
export function dropLockArtifacts(
  changes: readonly VerdictChange[],
  lock: EngineWord | null,
): VerdictChange[] {
  if (!lock) return [...changes];
  return changes.filter(c => !isBad(c)).map(withoutAdded);
}

/**
 * One chunk that judges REALIGN_WORDS or more words across REALIGN_AYAT or
 * more ayat is the tracker re-aligning a stretch it had left pending (mostly
 * the repeated refrains of Ar-Rahman), not words just heard: a live 480 ms
 * chunk judges one word, now and then two. On the planted-mistake bench,
 * ignoring the bad verdicts of such chunks removed 22 of 138 false marks for
 * 1 of 633 catches.
 */
export const REALIGN_WORDS = TUNED.realignWords;
export const REALIGN_AYAT = TUNED.realignAyat;

/**
 * Drops the bad verdicts of a chunk that judged REALIGN_WORDS or more words
 * across REALIGN_AYAT or more ayat at once (pending words do not count).
 * Other verdicts pass through.
 */
export function dropRealignment(
  changes: readonly VerdictChange[],
): VerdictChange[] {
  return isRealignment(changes)
    ? changes.filter(c => !isBad(c)).map(withoutAdded)
    : [...changes];
}

function isRealignment(changes: readonly VerdictChange[]): boolean {
  const judged = changes.filter(c => c.state !== 'pending' && !c.repeat);
  const ayat = new Set(judged.map(c => `${c.surah}:${c.ayah}`));
  return judged.length >= REALIGN_WORDS && ayat.size >= REALIGN_AYAT;
}

/**
 * This chunk's verdicts are not words just heard, so they wake no model. The
 * filters above keep its good verdicts, but they are not to be judged either.
 */
export function isFilteredChunk(
  changes: readonly VerdictChange[],
  lock: EngineWord | null,
): boolean {
  return lock !== null || isRealignment(changes);
}

/** The kind a bad verdict is suspected as, or null when it is not a slip. */
function suspectKind(change: VerdictChange): MarkKind | null {
  const junction = change.detail?.junctionMissing;
  if (junction === true) return 'missed';
  if (junction === false && change.state === 'skipped') return null;
  const gop = change.detail?.gop;
  if (change.state === 'skipped') {
    if (typeof gop === 'number' && gop > SKIP_FITS_GOP) return null;
    if (
      change.word === 0 &&
      typeof gop !== 'number' &&
      (change.detail?.heardRatio ?? 0) > FIRST_SKIP_HEARD
    ) {
      return null;
    }
    return 'missed';
  }
  if (change.state === 'wrong') {
    if (isBoundary(change)) return null;
    if (typeof gop === 'number' && gop > WRONG_FITS_GOP) return null;
    return 'wrong';
  }
  return null;
}

function noted(mark: WordMark, now?: number): WordMark {
  return {
    ...mark,
    status: 'noted',
    lastBadAt: now ?? mark.lastBadAt,
    junction: undefined,
  };
}

/**
 * An added mark stands on one of the word's sides, and a bad verdict at this time
 * is within its reach: red on the word would come from the same extra sounds.
 * @param at - When the verdict came (ms)
 */
function heldByAdded(
  book: MarkBook,
  word: EngineWord & {totalWords: number},
  at: number,
): boolean {
  const right =
    word.word + 1 < word.totalWords
      ? {...word, word: word.word + 1}
      : {surah: word.surah, ayah: word.ayah + 1, word: 0};
  return [word, right].some(side => {
    const added = book.get(addedKey(side));
    return added !== undefined && at - added.since <= ADDED_HOLD_MS;
  });
}

/**
 * @param audioTime - Audio time of the chunk these verdicts came from, kept on
 *   the marks they turn bad
 */
export function applyVerdicts(
  book: MarkBook,
  changes: readonly VerdictChange[],
  now: number,
  audioTime?: number,
): MarkUpdate {
  let next: Map<string, WordMark> | null = null;
  const corrected: WordMark[] = [];
  const confirmed: WordMark[] = [];
  const write = (key: string, mark: WordMark | null) => {
    next ??= new Map(book);
    if (mark) next.set(key, mark);
    else next.delete(key);
  };
  const addMark = (change: VerdictChange, left: EngineWord) => {
    const key = addedKey(change);
    if ((next ?? book).has(key)) return;
    const mark: WordMark = {
      surah: change.surah,
      ayah: change.ayah,
      word: change.word,
      totalWords: change.totalWords,
      kind: 'added',
      status: 'mistake',
      since: now,
      lastBadAt: now,
      lastBadAudio: audioTime,
    };
    write(key, mark);
    confirmed.push(mark);
    for (const word of [left, change]) {
      const redKey = markKey(word.surah, word.ayah, word.word);
      const red = (next ?? book).get(redKey);
      if (
        red &&
        red.status !== 'noted' &&
        red.status !== 'corrected' &&
        now - (red.lastBadAt ?? red.since) <= ADDED_HOLD_MS
      ) {
        write(redKey, {...noted(red), checkId: undefined});
      }
    }
  };
  for (const change of changes) {
    if (change.addedBefore) addMark(change, change.addedBefore.left);
    if (change.repeat && typeof change.detail?.junctionMissing !== 'boolean') {
      continue;
    }
    const key = markKey(change.surah, change.ayah, change.word);
    const mark = (next ?? book).get(key);
    if (isBad(change)) {
      const said =
        change.state === 'skipped' && change.detail?.junctionMissing === false;
      if (said && mark) {
        // No new verdict: a skipped suspect goes, and nothing else moves. The
        // judge's 'absent' stands against it, as it does when it comes after.
        if (
          mark.status === 'suspect' &&
          mark.kind === 'missed' &&
          !mark.identified
        ) {
          write(key, noted(mark));
        }
        continue;
      }
      const kind = heldByAdded(next ?? book, change, now)
        ? null
        : suspectKind(change);
      const unsaid = kind && change.detail?.junctionMissing === true;
      // The check ran on the next word: the reader has carried on, and it is no
      // flicker, so the mark is due now.
      const carriedOn = unsaid
        ? {
            followedAt: now,
            since: now - MARK_CONFIRM_MS,
            junction: true,
            judgeUntil: undefined,
          }
        : {};
      const fresh = {
        surah: change.surah,
        ayah: change.ayah,
        word: change.word,
        totalWords: change.totalWords,
        since: now,
        lastBadAt: now,
        lastBadAudio: audioTime,
      };
      const lastBad = {
        lastBadAt: now,
        lastBadAudio: audioTime ?? mark?.lastBadAudio,
      };
      if (
        kind &&
        (!mark || mark.status === 'corrected' || mark.status === 'noted')
      ) {
        write(key, {...fresh, kind, status: 'suspect', ...carriedOn});
      } else if (kind && mark?.status === 'suspect') {
        write(key, {...mark, kind, ...lastBad, ...carriedOn});
      } else if (unsaid && mark?.status === 'checking') {
        write(key, {
          ...mark,
          kind: 'missed',
          status: 'suspect',
          checkId: undefined,
          ...lastBad,
          ...carriedOn,
        });
      } else if (mark) {
        write(key, {...mark, ...lastBad});
      } else {
        const asKind: MarkKind =
          change.state === 'skipped' ? 'missed' : 'wrong';
        write(key, {...fresh, kind: asKind, status: 'noted'});
      }
      continue;
    }
    if (change.state === 'ok') {
      // The reader carried on correctly after a suspect.
      for (const [k, m] of next ?? book) {
        if (
          m.status === 'suspect' &&
          m.followedAt === undefined &&
          now >= m.since &&
          now - m.since <= NEXT_OK_WINDOW_MS &&
          follows(m, change)
        ) {
          write(k, {...m, followedAt: now});
        }
      }
    }
    if (!mark) continue;
    if (
      mark.status === 'suspect' ||
      (mark.status === 'checking' && change.state === 'ok')
    ) {
      // Flipped back inside the confirm window: never shown.
      write(key, noted(mark));
    } else if (mark.status === 'mistake' && change.state === 'ok') {
      const fixed: WordMark = {
        ...mark,
        status: 'corrected',
        junction: undefined,
      };
      write(key, fixed);
      corrected.push(fixed);
    }
  }
  return {book: next ?? book, confirmed, corrected};
}

/** A verdict seen lately, for an answer that comes after it. */
export interface SeenVerdict extends EngineWord {
  state: VerdictState;
  at: number;
}

/** Adds this chunk's verdicts to the ones seen lately, and lets old ones go. */
export function rememberVerdicts(
  seen: readonly SeenVerdict[],
  changes: readonly VerdictChange[],
  now: number,
): SeenVerdict[] {
  const kept = seen.filter(v => now - v.at <= SEEN_KEEP_MS);
  for (const c of changes) {
    if (!c.repeat) {
      kept.push({
        surah: c.surah,
        ayah: c.ayah,
        word: c.word,
        state: c.state,
        at: now,
      });
    }
  }
  return kept;
}

/** What the second judge says about a word. */
export type JudgeAnswer = 'wrong' | 'absent' | 'fits' | 'neither';

/** The verdict that woke the second judge. */
export interface JudgedVerdict extends EngineWord {
  totalWords: number;
  state: VerdictState;
  /** When it came (ms). */
  at: number;
  /** Seconds of the take's fed audio at the end of its chunk. */
  audioTime?: number;
}

/** The word was heard since this verdict in any other way than badly. */
function heardSince(
  verdict: JudgedVerdict,
  seen: readonly SeenVerdict[],
): boolean {
  return seen.some(
    v =>
      v.at > verdict.at &&
      v.state !== 'wrong' &&
      v.state !== 'skipped' &&
      v.surah === verdict.surah &&
      v.ayah === verdict.ayah &&
      v.word === verdict.word,
  );
}

/**
 * Whether the second judge's answer about this verdict can still change anything but
 * the wait. When it cannot, no model need run for it.
 */
export function judgeAnswerMatters(
  book: MarkBook,
  verdict: JudgedVerdict,
  seen: readonly SeenVerdict[],
): boolean {
  const mark = book.get(markKey(verdict.surah, verdict.ayah, verdict.word));
  if (mark?.junction || mark?.status === 'mistake') return false;
  return !heldByAdded(book, verdict, verdict.at) && !heardSince(verdict, seen);
}

/** A suspect waits for the judge, up to JUDGE_WAIT_MS, before it may show. */
export function holdForJudge(
  book: MarkBook,
  word: EngineWord,
  now: number,
): MarkBook {
  const key = markKey(word.surah, word.ayah, word.word);
  const mark = book.get(key);
  if (mark?.status !== 'suspect' || mark.junction) return book;
  const next = new Map(book);
  next.set(key, {...mark, judgeUntil: now + JUDGE_WAIT_MS, judgeHeld: true});
  return next;
}

/** The take is over: no answer is coming, so no suspect waits for one. */
export function endJudgeWaits(book: MarkBook): MarkBook {
  let next: Map<string, WordMark> | null = null;
  for (const [key, mark] of book) {
    if (mark.status !== 'suspect' || mark.judgeUntil === undefined) continue;
    next ??= new Map(book);
    next.set(key, {...mark, judgeUntil: undefined});
  }
  return next ?? book;
}

/**
 * The second judge's answer, as it arrives, about a second after its verdict.
 * 'wrong': another word was said. The word becomes a suspect, past the ayah-edge
 * and gop-fits rules, from the verdict's time. 'absent', on a wrong or skipped
 * verdict: the same, as a missed word. 'fits', on an interior wrong or a skipped
 * verdict: its suspect goes. A junction mark takes no answer, and a word heard
 * since then in any other way than badly takes none either: the verdict the judge
 * looked at has gone. A next-word ok seen since the verdict counts, whether or not
 * there was a suspect to credit when it came.
 */
export function applyJudgeAnswer(
  book: MarkBook,
  verdict: JudgedVerdict,
  answer: JudgeAnswer,
  seen: readonly SeenVerdict[],
): MarkBook {
  const key = markKey(verdict.surah, verdict.ayah, verdict.word);
  let mark = book.get(key);
  let out = book;
  // Only the answer to the latest verdict ends the wait.
  if (mark?.judgeUntil === verdict.at + JUDGE_WAIT_MS) {
    mark = {...mark};
    delete mark.judgeUntil;
    const next = new Map(book);
    next.set(key, mark);
    out = next;
  }
  if (answer === 'neither' || mark?.junction) return out;
  if (heardSince(verdict, seen)) return out;
  if (answer === 'fits') {
    const interior = verdict.word > 0 && verdict.word < verdict.totalWords - 1;
    const vetoes =
      verdict.state === 'skipped' || (verdict.state === 'wrong' && interior);
    // A newer bad verdict has its own answer coming, and this one is not about it.
    if (
      !vetoes ||
      !mark ||
      (mark.status !== 'suspect' && mark.status !== 'noted') ||
      (mark.lastBadAt ?? 0) > verdict.at
    ) {
      return out;
    }
    const next = new Map(out);
    // Made by this very verdict, it was never bad: nothing is left of it, and it
    // does not count towards the confusion rule.
    if (mark.since === verdict.at) next.delete(key);
    else next.set(key, noted(mark));
    return next;
  }
  const bad = verdict.state === 'wrong' || verdict.state === 'skipped';
  if (answer === 'absent' && !bad) return out;
  if (mark?.status === 'mistake' || mark?.status === 'checking') return out;
  if (heldByAdded(out, verdict, verdict.at)) return out;
  const kind: MarkKind = answer === 'wrong' ? 'wrong' : 'missed';
  const followedAt = seen.find(
    v =>
      v.state === 'ok' &&
      v.at >= verdict.at &&
      v.at - verdict.at <= NEXT_OK_WINDOW_MS &&
      follows(verdict, v),
  )?.at;
  const next = new Map(out);
  next.set(
    key,
    mark?.status === 'suspect'
      ? {
          ...mark,
          // A newer verdict has said what kind it is.
          kind: (mark.lastBadAt ?? 0) > verdict.at ? mark.kind : kind,
          followedAt: mark.followedAt ?? followedAt,
          identified: mark.identified || verdict.at >= mark.since || undefined,
          judgeHeld: true,
        }
      : {
          surah: verdict.surah,
          ayah: verdict.ayah,
          word: verdict.word,
          totalWords: verdict.totalWords,
          kind,
          status: 'suspect',
          since: verdict.at,
          lastBadAt: verdict.at,
          lastBadAudio: verdict.audioTime,
          followedAt,
          identified: true,
          judgeHeld: true,
        },
  );
  return next;
}

/** When a suspect is shown or dropped. */
function dueAt(mark: WordMark): number {
  const due =
    mark.followedAt === undefined
      ? mark.since + NEXT_OK_WINDOW_MS
      : Math.max(mark.since + MARK_CONFIRM_MS, mark.followedAt);
  return mark.judgeUntil === undefined ? due : Math.max(due, mark.judgeUntil);
}

/**
 * Other words around `mark` that went bad from just before it until now. A word the
 * second judge held back is seen as at the time it would have fallen due with no judge:
 * what went bad after that does not count, and what went bad before it and again later
 * still does.
 */
function confused(book: MarkBook, mark: WordMark, now: number): boolean {
  const ownTime = Math.max(mark.since + MARK_CONFIRM_MS, mark.followedAt ?? 0);
  const upTo = mark.judgeHeld ? Math.min(now, ownTime) : now;
  const inWindow = (t: number) =>
    t >= mark.since - NEIGHBOUR_WINDOW_MS && t <= upTo;
  let around = 0;
  for (const m of book.values()) {
    if (
      m.kind === 'added' ||
      m.surah !== mark.surah ||
      m.ayah !== mark.ayah ||
      m.word === mark.word ||
      Math.abs(m.word - mark.word) > NEIGHBOUR_SPAN
    ) {
      continue;
    }
    if (
      inWindow(m.lastBadAt ?? m.since) ||
      (mark.judgeHeld && inWindow(m.since))
    ) {
      around += 1;
    }
  }
  return around >= CONFUSED_NEIGHBOURS;
}

/**
 * Turns suspects that held for MARK_CONFIRM_MS and were followed by a
 * correct word into mistakes, and drops the ones never followed in time or
 * caught up in confusion.
 */
export function confirmDue(book: MarkBook, now: number): MarkUpdate {
  let next: Map<string, WordMark> | null = null;
  const confirmed: WordMark[] = [];
  for (const [key, mark] of book) {
    if (mark.status !== 'suspect' || now < dueAt(mark)) continue;
    next ??= new Map(book);
    if (mark.followedAt === undefined || confused(book, mark, now)) {
      next.set(key, noted(mark));
      continue;
    }
    const shown: WordMark = {...mark, status: 'mistake'};
    next.set(key, shown);
    confirmed.push(shown);
  }
  return {book: next ?? book, confirmed, corrected: []};
}

/**
 * Holds back marks confirmDue just confirmed, for a second look: confirmed
 * marks go in, 'checking' marks come out. Only cancelCheck and finishChecks
 * move them on, or an ok verdict on the word, as for a suspect. Other verdicts
 * leave them alone, as they would a shown mistake.
 */
export function startChecks(
  book: MarkBook,
  marks: readonly WordMark[],
  checkId: number,
): MarkBook {
  const next = new Map(book);
  for (const mark of marks) {
    next.set(markKey(mark.surah, mark.ayah, mark.word), {
      ...mark,
      status: 'checking',
      checkId,
    });
  }
  return next;
}

/**
 * The second look found that the word fits: never shown. Does nothing unless the
 * mark is still waiting for this very check.
 */
export function cancelCheck(
  book: MarkBook,
  word: EngineWord,
  checkId: number,
): MarkBook {
  const key = markKey(word.surah, word.ayah, word.word);
  const mark = book.get(key);
  if (mark?.status !== 'checking' || mark.checkId !== checkId) return book;
  const next = new Map(book);
  next.set(key, {...noted(mark), checkId: undefined});
  return next;
}

/**
 * The marks of a check that are still waiting become mistakes, or with no
 * checkId all marks still waiting (the take is over). Returned as confirmed.
 */
export function finishChecks(book: MarkBook, checkId?: number): MarkUpdate {
  let next: Map<string, WordMark> | null = null;
  const confirmed: WordMark[] = [];
  for (const [key, mark] of book) {
    if (mark.status !== 'checking') continue;
    if (checkId !== undefined && mark.checkId !== checkId) continue;
    next ??= new Map(book);
    const shown: WordMark = {...mark, status: 'mistake', checkId: undefined};
    next.set(key, shown);
    confirmed.push(shown);
  }
  return {book: next ?? book, confirmed, corrected: []};
}

/**
 * The engine lost the reader (or went idle): its pending suspicions are no
 * longer trustworthy. Shown mistakes stay, and so does a suspect past its own time
 * that waits only for the second judge: with no judge it would have shown by now.
 */
export function dropSuspects(book: MarkBook, now?: number): MarkBook {
  let next: Map<string, WordMark> | null = null;
  for (const [key, mark] of book) {
    if (mark.status !== 'suspect') continue;
    if (
      now !== undefined &&
      mark.judgeUntil !== undefined &&
      mark.followedAt !== undefined &&
      now >= Math.max(mark.since + MARK_CONFIRM_MS, mark.followedAt)
    ) {
      continue;
    }
    next ??= new Map(book);
    next.set(key, noted(mark));
  }
  return next ?? book;
}

/**
 * Whether an answer still out about this verdict would have shown its word by now,
 * had it come at once: MARK_CONFIRM_MS has gone by and a next word was heard in time.
 * Then losing the reader does not take it back.
 */
export function judgeAnswerStillDue(
  verdict: JudgedVerdict,
  seen: readonly SeenVerdict[],
  now: number,
): boolean {
  if (now < verdict.at + MARK_CONFIRM_MS) return false;
  return seen.some(
    v =>
      v.state === 'ok' &&
      v.at >= verdict.at &&
      v.at <= now &&
      v.at - verdict.at <= NEXT_OK_WINDOW_MS &&
      follows(verdict, v),
  );
}

/** The earliest time a suspect is shown or dropped, or null with none. */
export function nextConfirmAt(book: MarkBook): number | null {
  let at: number | null = null;
  for (const mark of book.values()) {
    if (mark.status !== 'suspect') continue;
    const due = dueAt(mark);
    if (at === null || due < at) at = due;
  }
  return at;
}

/** Words at the start of the ayah after a skipped one that are not shown. */
const AFTER_SKIP_WORDS = TUNED.afterSkipWords;

function leftToAyahFlag(
  mark: WordMark,
  skippedAyat: ReadonlySet<string>,
): boolean {
  if (skippedAyat.has(`${mark.surah}:${mark.ayah}`)) return true;
  // The tracker lands in the next ayah a few words late after the jump.
  return (
    mark.word < AFTER_SKIP_WORDS &&
    skippedAyat.has(`${mark.surah}:${mark.ayah - 1}`)
  );
}

/**
 * Mistakes and corrected words to draw, in recitation order. Words inside an
 * ayah flagged as skipped, and the first words of the ayah after it, are left
 * to that flag.
 * @param skippedAyat - "surah:ayah" keys of ayat flagged as skipped
 */
export function shownMarks(
  book: MarkBook,
  skippedAyat: ReadonlySet<string>,
): WordMark[] {
  return [...book.values()]
    .filter(
      m =>
        (m.status === 'mistake' || m.status === 'corrected') &&
        !leftToAyahFlag(m, skippedAyat),
    )
    .sort((a, b) => a.surah - b.surah || a.ayah - b.ayah || a.word - b.word);
}
