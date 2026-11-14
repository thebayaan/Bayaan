import {matchWords, type LayCosts, type Step} from './laying';
import {
  FRAME_SECONDS,
  idsOf,
  MEL_PER_FRAME,
  MEL_PER_SECOND,
  pathScore,
  quietRuns,
  read,
  sameWord,
  SEP,
  startsWith,
  type Heard,
} from './reading';
import type {
  LiveCheck,
  LiveDeps,
  LiveOpinion,
  LivePlace,
  LivePlan,
  LiveVerdict,
} from './types';

// The live check. About twice a second the second model reads the audio of the ayah
// being recited, from the ayah's start to now, and this file says for each word that
// has enough audio after it whether the written word was said.
//
// How a run goes:
//
// 1. The model's own reading (its best token in each frame) is cut into words.
// 2. Those words are laid against the text the reader should be saying, word by word:
//    a word may match, differ, be left out, be extra, be the start of a word said
//    again, and the reading may jump back, which is how re-reading shows. Jumps back
//    are cheap, so a reader who goes back and reads again is followed, never marked.
// 3. A word that differs or is left out is then tested on the scores: the model's
//    reading is kept as it is everywhere else, the written word is put in its place,
//    and the best path through that text is compared with the reading itself. The gap
//    is how much the audio prefers what the model wrote over what is written.
// 4. Only a word that fails both, with sound words around it, on two runs in a row,
//    becomes 'changed' or 'missed'.
//
// Three things were measured before this was written (scripts/recitation-bench/fix2):
//
// - The model reads one ayah at a time. A window that holds the end of one ayah and the
//   start of the next garbles both, so a window never spans two ayat: it starts where
//   the ayah starts, and the next ayah gets a new one.
// - A word in the middle of an ayah reads reliably only once about two seconds of the
//   ayah have followed it. An ayah's last word reads at once, in the pause after it.
// - When an ayah is longer than the window, the window starts at a word, and the words
//   just after that cut read badly (two after a cut between words, one after a cut in
//   a pause): they are context, and are never judged there.
//
// The follower says which ayah the reader is in and nothing else. No cut in the audio
// comes from it.
//
// Text here is lists of letter numbers inside the computation. Nothing is shown,
// logged as text or stored.

export interface LiveConfig extends LayCosts {
  /** The most audio one run reads, in seconds. The stream keeps ten. */
  windowSeconds: number;
  /** A run needs at least this much audio. */
  minSeconds: number;
  /** A word inside an ayah is judged once this much of the ayah has followed the next word's start. */
  rightSeconds: number;
  /** The bench's probe also sees words tested earlier than that, from this much on. */
  probeSeconds: number;
  /** A pause: quiet at least this long. */
  pauseSeconds: number;
  /** Quiet this long after an ayah's last word and the ayah is over. */
  endQuietSeconds: number;
  /** Quiet this long after any other word the reader stopped on and it is judged. */
  midQuietSeconds: number;
  /** A frame is quiet under this share of the way from the window's quietest to its loudest, */
  quietShare: number;
  /** when the two are at least this far apart (mean log-mel). */
  quietSpread: number;
  /** A new ayah's window keeps at most this much quiet before its first sound. */
  leadSeconds: number;
  /** After a cut inside an ayah, this many words are context only. */
  leftWords: number;
  /** Words at the start of the next ayah, to see when the model has gone on to it. */
  nextWords: number;
  /**
   * A changed word: the written word must lose by at least this many nats. Spliced
   * mistakes lose 14 or more (5th percentile) and 46 at the median; what background
   * speech and the model's own slips produce sits mostly under 12.
   */
  changedGap: number;
  /** or by this many for each of its letters, whichever is less. */
  changedGapPerLetter: number;
  /** A changed word's letters must differ by at least this share. */
  changedShare: number;
  /** A missed word: putting it back must cost at least this many nats. */
  missedGap: number;
  missedGapPerLetter: number;
  /** A gap this many times the need settles a verdict on one run. */
  strongTimes: number;
  /** Otherwise a bad verdict must hold on this many runs in a row. */
  persistRuns: number;
  /** More words than this left out in a row is a jump, which is not this check's to mark. */
  maxMissedRun: number;
  /** The longest run of words that did not read right in which a word may be called bad. */
  runWords: number;
  /**
   * A new ayah's window whose edge was put just before its first word, heard by the
   * short window with no pause before it: this many words are context only.
   */
  foundContext: number;
  /** The short window may find an ayah that starts at its second word, after a pause. */
  handoverSkipFirst: boolean;
  /**
   * An ayah left with no pause still has its last two words judged, on its last look.
   * Off, they are judged only when a pause follows the ayah.
   */
  judgeCutShort: boolean;
  /**
   * Bench only: trust the first word of an ayah found with no pause before it. It
   * failed on recitations kept back for validation and stays off.
   */
  trustHandover: boolean;
  /** Below this share of heard words matching the text, a run says nothing. */
  minFit: number;
  /** This many such runs in a row and the place is looked for again. */
  misfitRuns: number;
  /** Runs the follower may sit in another ayah before the place is looked for again. */
  driftRuns: number;
  /** Runs the follower sits in the next ayah before the check goes there without a pause. */
  onwardRuns: number;
}

export const LIVE_DEFAULTS: LiveConfig = {
  windowSeconds: 9.6,
  minSeconds: 0.8,
  rightSeconds: 2.0,
  probeSeconds: 2.0,
  pauseSeconds: 0.2,
  endQuietSeconds: 0.5,
  midQuietSeconds: 0.6,
  quietShare: 0.3,
  quietSpread: 3,
  leadSeconds: 0.6,
  leftWords: 2,
  nextWords: 2,
  anchorShare: 0.34,
  changedGap: 15,
  changedGapPerLetter: 5,
  changedShare: 0.2,
  missedGap: 15,
  missedGapPerLetter: 5,
  strongTimes: 2,
  persistRuns: 2,
  maxMissedRun: 3,
  runWords: 3,
  foundContext: 1,
  handoverSkipFirst: true,
  judgeCutShort: true,
  trustHandover: false,
  minFit: 0.5,
  misfitRuns: 3,
  driftRuns: 5,
  onwardRuns: 2,
  extraCost: 1.0,
  missCost: 0.9,
  moreMissCost: 0.05,
  joinCost: 0.75,
  backCost: 0.3,
  startAgainCost: 0.25,
};

/** One written word of the text a run is laid against. */
interface TextWord {
  surah: number;
  ayah: number;
  word: number;
  totalWords: number;
  ids: number[];
  /** 'ayah': the ayah being read. 'before' and 'next' are its neighbours' nearest words. */
  part: 'before' | 'ayah' | 'next';
}

/** One time the reader passed a written word, as one run sees it. */
interface Visit {
  text: TextWord;
  kind: 'match' | 'join' | 'split' | 'miss';
  share: number;
  /** The heard word it took (the first of two for a split), or for a missed word the one that came next. */
  i: number;
  /** The last heard word it took. */
  lastHeard: number;
  /** Model frames from the window's start: its first letter, and when its last letter first showed. */
  from: number;
  at: number;
  /** The heard word after it, or -1 when it is the newest. */
  nextHeard: number;
  /** The newest heard word, so far only the start of its written word. */
  partial: boolean;
  /** The reader began this word, stopped and said it again: the piece before it was its start. */
  restarted: boolean;
}

interface Segment {
  surah: number;
  ayah: number;
  words: number[][];
  /** The window's left edge, in log-mel frames of the stream. */
  startMel: number;
  /** The first word of the ayah the window may hold. */
  startWord: number;
  /** The left edge sits just before `startWord`: the reading must start there. */
  fixedStart: boolean;
  /** Words before this one are never judged in this window. */
  judgeFrom: number;
  /** No cut has placed the edge yet: the place is still being found. */
  finding: boolean;
  /** Nothing of this ayah has been heard in this window yet. */
  fresh: boolean;
  /** The ayah read just before, which the reader may be reading again. */
  again: number | null;
  misfits: number;
  /** Times the left edge was moved past sounds that were not this ayah's. */
  settles: number;
  /** After a wrong guess that the reader had gone on, no new guess before this run. */
  noHandoverUntil: number;
  /** The window starts in a pause, or where the take starts. */
  cleanStart: boolean;
  /** The short window heard this ayah's first word: the edge sits just before it. */
  found: boolean;
  /** Where in the stream the ayah's last word was last heard, in log-mel frames. */
  endedMel: number | null;
  drift: number;
  onward: number;
  /** Each word's first frame in the stream, as the last run that heard it placed it. */
  placed: Map<number, number>;
  /** The words that came after a pause: a window may start at one with less context. */
  afterPause: Set<number>;
}

interface Decision {
  surah: number;
  ayah: number;
  word: number;
  totalWords: number;
  reading: number;
  verdict: LiveVerdict;
  final: boolean;
  letterShare: number;
  gap: number;
  audioFrom: number;
  audioTo: number;
  /** Runs in a row that called it bad. */
  badRuns: number;
}

/** What the bench reads to tune and explain: one line per word tested on scores. */
export interface LiveProbe {
  run: number;
  key: string;
  reading: number;
  kind: 'changed' | 'missed';
  letters: number;
  share: number;
  gap: number;
  /** Seconds of the ayah heard after the word, and whether the ayah was over. */
  after: number;
  over: boolean;
  anchored: boolean;
  outcome: 'bad' | 'weak' | 'unanchored' | 'early';
  closing: boolean;
  final: boolean;
  /** The letters the model wrote there, as numbers, and the written word's. */
  heard: number[];
  written: number[];
  /**
   * How the written words two before, one before, one after and two after were
   * heard: the share of their letters that differed, or -1 for a word not heard as
   * itself there.
   */
  around: [number, number, number, number];
  /** The window started in a pause, and ended in quiet after the ayah. */
  lead: boolean;
  end: boolean;
}

const keyOf = (w: {surah: number; ayah: number; word: number}) =>
  `${w.surah}:${w.ayah}:${w.word}`;

/** For the bench: what the check tested on scores, and a line a run. Unused in the app. */
export interface LiveWatch {
  probe?: (line: LiveProbe) => void;
  trace?: (line: string) => void;
}

export function createLiveCheck(
  deps: LiveDeps,
  overrides: Partial<LiveConfig> = {},
  watch: LiveWatch = {},
): LiveCheck {
  const {probe} = watch;
  const dbg = watch.trace;
  const config: LiveConfig = {...LIVE_DEFAULTS, ...overrides};
  const windowMel = Math.round(config.windowSeconds * MEL_PER_SECOND);
  /** What the stream keeps: ten seconds of log-mel frames. */
  const keptMel = 10 * MEL_PER_SECOND;
  const minMel = Math.round(config.minSeconds * MEL_PER_SECOND);
  const leadMel = Math.round(config.leadSeconds * MEL_PER_SECOND);
  const pauseFrames = Math.round(config.pauseSeconds / FRAME_SECONDS);
  const endFrames = Math.round(config.endQuietSeconds / FRAME_SECONDS);

  let place: LivePlace | null = null;
  let active = false;
  /** No word before this one, in its ayah, is judged: the reader was found here. */
  let lock: {surah: number; ayah: number; word: number; mel: number} | null =
    null;
  let segment: Segment | null = null;
  /** An ayah the reader has finished: read once more, alone, cut where it ends. */
  let closing: {
    segment: Segment;
    endMel: number;
    next: Segment | null;
    /** The next ayah's first word was heard: the reader has left this ayah for good. */
    byNext: boolean;
    /** A pause was seen between the last word and the next ayah's first. */
    paused?: boolean;
    /** Sound came before the quiet that ended the ayah: where it ends is not sure. */
    unsure?: boolean;
  } | null = null;
  /**
   * The ayah's last word has been heard. A second, short window from that word on
   * watches for the next ayah's first word, which the long window will not show: the
   * model reads one ayah and holds its end.
   */
  let handover: {fromMel: number} | null = null;
  type Kind = 'main' | 'closing' | 'handover';
  let lastPlan: (LivePlan & {kind: Kind}) | null = null;
  /** The plans made for the newest audio: the long window, then the short one. */
  let plannedFor = -1;
  let plannedMain = false;
  let plannedHandover = false;
  let planId = 0;
  let run = 0;
  /** Each word's readings so far: the newest one's number and when it started. */
  const readings = new Map<string, {reading: number; at: number}>();
  const decisions = new Map<string, Decision>();

  const lettersOf = (surah: number, ayah: number): number[][] | null => {
    if (ayah < 1 || ayah > deps.ayahCount(surah)) return null;
    const words = deps.letters(surah, ayah);
    if (!words || words.length === 0) return null;
    const ids = words.map(idsOf);
    return ids.every(w => w.length > 0) ? ids : null;
  };

  const newSegment = (
    surah: number,
    ayah: number,
    startMel: number,
    fixedStart: boolean,
    again: number | null,
  ): Segment | null => {
    const words = lettersOf(surah, ayah);
    if (!words) return null;
    const locked =
      lock && lock.surah === surah && lock.ayah === ayah ? lock.word : 0;
    return {
      surah,
      ayah,
      words,
      startMel: Math.max(0, Math.round(startMel)),
      startWord: 0,
      fixedStart,
      judgeFrom: locked,
      finding: !fixedStart,
      fresh: true,
      again,
      misfits: 0,
      settles: 0,
      noHandoverUntil: 0,
      cleanStart: false,
      found: false,
      endedMel: null,
      drift: 0,
      onward: 0,
      placed: new Map(),
      afterPause: new Set(),
    };
  };

  const dropWaiting = () => {
    for (const [id, d] of decisions) {
      if (!d.final) decisions.delete(id);
    }
  };

  const forget = () => {
    segment = null;
    closing = null;
    handover = null;
    lastPlan = null;
    dropWaiting();
  };

  /** The words of the ayat before and after this one. */
  const nearbyOf = new Map<string, number[][]>();
  const nearby = (seg: Segment): number[][] => {
    const key = `${seg.surah}:${seg.ayah}`;
    let words = nearbyOf.get(key);
    if (!words) {
      words = [
        ...(lettersOf(seg.surah, seg.ayah - 1) ?? []),
        ...(lettersOf(seg.surah, seg.ayah + 1) ?? []),
      ];
      nearbyOf.clear();
      nearbyOf.set(key, words);
    }
    return words;
  };

  /** The text a window is laid against. */
  const textOf = (seg: Segment, alone: boolean): TextWord[] => {
    const out: TextWord[] = [];
    const add = (
      ayah: number,
      words: number[][],
      from: number,
      to: number,
      part: TextWord['part'],
    ) => {
      for (let w = from; w < to; w++) {
        out.push({
          surah: seg.surah,
          ayah,
          word: w,
          totalWords: words.length,
          ids: words[w],
          part,
        });
      }
    };
    if (!alone && seg.finding && seg.startWord === 0) {
      const before = lettersOf(seg.surah, seg.ayah - 1);
      if (before) {
        const from = Math.max(0, before.length - config.leftWords);
        add(seg.ayah - 1, before, from, before.length, 'before');
      }
    }
    add(seg.ayah, seg.words, seg.startWord, seg.words.length, 'ayah');
    if (!alone) {
      const next = lettersOf(seg.surah, seg.ayah + 1);
      if (next) {
        add(
          seg.ayah + 1,
          next,
          0,
          Math.min(next.length, config.nextWords),
          'next',
        );
      }
    }
    return out;
  };

  /**
   * Moves a long ayah's left edge to the earliest word that still fits the window. The
   * words just after a cut read badly: two after a cut between words, one after a cut
   * in a pause. They are context there, and were judged before the cut if at all.
   */
  const slide = (seg: Segment, heard: number): void => {
    const earliest = heard - windowMel;
    if (seg.startMel >= earliest) return;
    let cut = -1;
    let cutMel = 0;
    for (const [w, mel] of seg.placed) {
      if (w <= seg.startWord || mel - 8 < earliest) continue;
      if (cut < 0 || w < cut) {
        cut = w;
        cutMel = mel;
      }
    }
    if (cut >= 0) {
      const paused = seg.afterPause.has(cut);
      seg.startMel = cutMel - (paused ? 16 : 8);
      seg.startWord = cut;
      seg.fixedStart = true;
      seg.finding = false;
      seg.judgeFrom = Math.max(
        seg.judgeFrom,
        cut + (paused ? 1 : config.leftWords),
      );
    } else {
      // No word to cut at: the edge falls where it falls, and the place is found again.
      seg.startMel = earliest;
      seg.fixedStart = false;
      seg.finding = true;
    }
    for (const w of [...seg.placed.keys()]) {
      if (w < seg.startWord) {
        seg.placed.delete(w);
        seg.afterPause.delete(w);
      }
    }
  };

  const planMain = (heard: number): LivePlan | null => {
    if (!place) return null;
    if (!segment) {
      const from = Math.max(lock ? lock.mel : 0, heard - windowMel, 0);
      segment = newSegment(place.surah, place.ayah, from, false, null);
      if (!segment) return null;
    }
    if (segment.fresh && segment.fixedStart) {
      // Nothing heard yet: keep the quiet before the first sound short.
      segment.startMel = Math.max(segment.startMel, heard - windowMel);
    } else {
      slide(segment, heard);
    }
    if (heard - segment.startMel < minMel) return null;
    lastPlan = {from: segment.startMel, to: heard, id: ++planId, kind: 'main'};
    return {from: lastPlan.from, to: lastPlan.to, id: lastPlan.id};
  };

  /**
   * Up to three windows for the same audio: ask again after step() until null. After
   * the long one come the short one that watches for the next ayah and an ayah's last
   * look.
   */
  const plan = (heard: number): LivePlan | null => {
    if (!active || !place) return null;
    if (heard !== plannedFor) {
      plannedFor = heard;
      plannedMain = false;
      plannedHandover = false;
    }
    if (closing) {
      const seg = closing.segment;
      const to = Math.min(closing.endMel, heard);
      const from = Math.max(seg.startMel, to - windowMel);
      // The stream keeps ten seconds. A last look that had to wait, the model being
      // busy, until its window left them is given up: asked for again it could never
      // be read, and nothing else would be planned.
      if (to - from >= minMel && from >= heard - keptMel) {
        lastPlan = {from, to, id: ++planId, kind: 'closing'};
        return {from, to, id: lastPlan.id};
      }
      segment = closing.next;
      closing = null;
    }
    if (!plannedMain) {
      plannedMain = true;
      const main = planMain(heard);
      if (main) return main;
    }
    if (!plannedHandover && handover && segment) {
      plannedHandover = true;
      const from = Math.max(handover.fromMel, heard - windowMel);
      if (heard - from >= minMel / 2) {
        lastPlan = {from, to: heard, id: ++planId, kind: 'handover'};
        return {from, to: heard, id: lastPlan.id};
      }
    }
    return null;
  };

  const step = (
    planned: LivePlan,
    logp: Float32Array,
    frames: number,
    energy?: Float32Array,
  ): LiveOpinion[] => {
    if (!lastPlan || planned.id !== lastPlan.id || !active) return [];
    const kind = lastPlan.kind;
    // One model output is one run: stepping a plan again counts nothing.
    lastPlan = null;
    const isClosing = kind === 'closing';
    const seg = isClosing ? closing?.segment : segment;
    if (!seg) return [];
    run += 1;
    const {rel, tokens, words: heard} = read(logp, frames);
    const melOf = (frame: number) => planned.from + frame * MEL_PER_FRAME;
    const secondsOf = (frame: number) => melOf(frame) / MEL_PER_SECOND;
    const quiet = energy ? quietRuns(energy, config) : [];
    if (kind === 'handover') {
      watchForNext(seg, planned, heard, quiet, frames);
      return opinionsIn(planned);
    }

    // A new ayah's window: nothing said yet. Keep only a little quiet before the sound.
    if (!isClosing && seg.fresh && seg.fixedStart && heard.length === 0) {
      const lead = quiet.find(q => q.from === 0);
      // With no quiet stretch found the window is all of a kind: wait at its end.
      const sound = lead
        ? melOf(lead.to)
        : quiet.length > 0
          ? planned.from
          : planned.to;
      seg.startMel = Math.max(seg.startMel, sound - leadMel);
      return opinionsIn(planned);
    }

    let text = textOf(seg, isClosing);
    // An ayah left for the next one is laid to its end: its last word was said,
    // changed or left out, and the laying must say which.
    const toTheEnd = isClosing && !!closing?.byNext;
    let steps = matchWords(
      heard,
      text.map(t => t.ids),
      seg.fixedStart && !seg.finding,
      toTheEnd,
      config,
    );
    const fitOf = (list: readonly Step[]) => {
      let anchors = 0;
      for (const s of list) {
        if (
          (s.kind === 'match' || s.kind === 'join' || s.kind === 'split') &&
          s.share <= config.anchorShare
        ) {
          anchors += s.kind === 'split' ? 2 : 1;
        }
      }
      return heard.length === 0 ? 1 : anchors / heard.length;
    };
    let fit = fitOf(steps);
    // The reader may be reading the ayah just read again, not the next one. Two ayat
    // that look alike both fit a little, so the two are laid side by side and the
    // cheaper one is taken.
    if (!isClosing && seg.fresh && seg.again !== null && heard.length >= 2) {
      const words = lettersOf(seg.surah, seg.again);
      if (words) {
        const other: Segment = {...seg, ayah: seg.again, words, again: null};
        const otherText = textOf(other, false);
        const otherSteps = matchWords(
          heard,
          otherText.map(t => t.ids),
          true,
          false,
          config,
        );
        if (otherSteps.cost + 0.25 < steps.cost) {
          seg.ayah = other.ayah;
          seg.words = words;
          seg.again = null;
          const locked =
            lock && lock.surah === seg.surah && lock.ayah === seg.ayah
              ? lock.word
              : 0;
          seg.judgeFrom = locked;
          text = otherText;
          steps = otherSteps;
          fit = fitOf(steps);
        }
      }
    }

    if (dbg) {
      dbg(
        `run ${run} ${isClosing ? 'closing ' : ''}${seg.surah}:${
          seg.ayah
        } from word ${seg.startWord} fixed=${seg.fixedStart} finding=${
          seg.finding
        } judgeFrom=${seg.judgeFrom} mel=${planned.from}-${
          planned.to
        } frames=${frames} fit=${fit.toFixed(2)} quiet=[${quiet
          .map(q => `${q.from.toFixed(0)}-${q.to.toFixed(0)}`)
          .join(' ')}] heard=[${heard
          .map(h => `${h.ids.length}@${h.from}-${h.at}`)
          .join(' ')}] steps=[${steps
          .map(s =>
            s.kind === 'extra'
              ? `x${s.i}`
              : s.kind === 'again'
                ? `a${s.i}`
                : `${s.kind === 'miss' ? '-' : s.kind[0]}${s.i}>${
                    text[s.j].part[0]
                  }${text[s.j].word}${
                    'share' in s && s.share > 0 ? `(${s.share.toFixed(2)})` : ''
                  }`,
          )
          .join(' ')}]`,
      );
    }

    // A new ayah's window that starts with sounds that are not its text: the cut
    // left the end of the ayah before in it. Move the edge to the first word that
    // is, and look again.
    if (
      !isClosing &&
      seg.fixedStart &&
      seg.startWord === 0 &&
      seg.settles < 3
    ) {
      const lead = steps.findIndex(
        s => s.kind !== 'extra' && s.kind !== 'again',
      );
      const firstStep = lead >= 0 ? steps[lead] : undefined;
      if (
        lead > 0 &&
        firstStep &&
        firstStep.kind === 'match' &&
        firstStep.j === text.findIndex(t => t.part === 'ayah') &&
        firstStep.share <= config.anchorShare &&
        heard[firstStep.i].from >= 4
      ) {
        seg.settles += 1;
        seg.cleanStart = false;
        seg.found = false;
        seg.startMel = melOf(heard[firstStep.i].from - 3);
        seg.placed.clear();
        seg.afterPause.clear();
        return opinionsIn(planned);
      }
    }

    // Does the text fit at all? If not, this run says nothing.
    if (heard.length >= 3 && fit < config.minFit) {
      if (isClosing) {
        segment = closing?.next ?? null;
        closing = null;
      } else {
        seg.misfits += 1;
        if (seg.misfits >= config.misfitRuns) forget();
      }
      return opinionsIn(planned);
    }
    seg.misfits = 0;
    if (heard.length >= 2) seg.fresh = false;

    // The visits, in the order the reader made them.
    const visits: Visit[] = [];
    let restarted = false;
    for (const s of steps) {
      if (s.kind === 'again') restarted = true;
      if (s.kind === 'extra' || s.kind === 'again') continue;
      const lastHeard = s.kind === 'split' ? s.i + 1 : s.i;
      const missed = s.kind === 'miss';
      // A word left out at the very end has no heard word after it.
      const trailing = missed && s.i >= heard.length;
      const push = (j: number, shareOf: number) => {
        visits.push({
          text: text[j],
          kind: s.kind,
          share: missed ? 1 : shareOf,
          i: s.i,
          lastHeard: missed ? s.i : lastHeard,
          from: trailing ? frames - 1 : heard[s.i].from,
          at: trailing
            ? frames - 1
            : missed
              ? heard[s.i].from
              : heard[lastHeard].at,
          nextHeard: trailing
            ? -1
            : missed
              ? s.i
              : lastHeard + 1 < heard.length
                ? lastHeard + 1
                : -1,
          partial: false,
          restarted,
        });
        restarted = false;
      };
      if (s.kind === 'join') {
        push(s.j, s.share);
        push(s.j + 1, s.share);
      } else {
        push(s.j, missed ? 1 : s.share);
      }
    }
    // The newest heard word, when it is so far only the start of its written word,
    // is not a reading yet.
    const newest = visits[visits.length - 1];
    if (
      newest &&
      newest.kind === 'match' &&
      newest.lastHeard === heard.length - 1 &&
      newest.share > 0 &&
      startsWith(newest.text.ids, heard[newest.i].ids)
    ) {
      newest.partial = true;
    }

    // Where each word of the ayah starts, and whether quiet came before it, for the
    // next cut.
    for (const v of visits) {
      if (v.text.part !== 'ayah' || v.kind === 'miss') continue;
      seg.placed.set(v.text.word, melOf(v.from));
      const paused = quiet.some(
        q =>
          q.to - q.from >= pauseFrames &&
          q.to >= v.from - 3 &&
          q.to <= v.from + 1,
      );
      if (paused) seg.afterPause.add(v.text.word);
      else seg.afterPause.delete(v.text.word);
    }
    // A new ayah's window that was not cut in a pause was cut where the check guessed
    // the ayah starts, with nothing to show the guess is right: its first words are
    // context, as after any cut between words. Readers who pause between ayat, as
    // most do, get every first word judged.
    const contextFrom =
      seg.startWord === 0 && seg.fixedStart && !seg.cleanStart
        ? seg.found
          ? config.foundContext
          : config.leftWords
        : 0;
    // While the place is being found, the first words heard are context, unless the
    // window starts where the take starts or the reading came in from the ayah before.
    if (seg.finding) {
      const first = visits.find(v => v.text.part === 'ayah');
      const at = first ? visits.indexOf(first) : -1;
      const before = at > 0 ? visits[at - 1] : undefined;
      const cameIn =
        !!first &&
        first.text.word === 0 &&
        !!before &&
        before.text.part === 'before' &&
        before.kind === 'match' &&
        before.share === 0 &&
        before.text.word === before.text.totalWords - 1;
      if (first && !cameIn && planned.from > 0) {
        seg.judgeFrom = Math.max(
          seg.judgeFrom,
          first.text.word + config.leftWords,
        );
      }
    }

    // An ayah thought to be over because the next one's first word was heard, whose
    // last look does not show its own last word: the cut came too soon. Two ayat
    // that open and close alike do this. Go back to it and wait.
    const lastWord = seg.words.length - 1;
    if (
      isClosing &&
      closing?.byNext &&
      !visits.some(
        v =>
          v.text.part === 'ayah' &&
          v.text.word === lastWord &&
          v.kind !== 'miss' &&
          v.share <= config.anchorShare,
      )
    ) {
      seg.noHandoverUntil = run + 4;
      segment = seg;
      closing = null;
      handover = null;
      return opinionsIn(planned);
    }
    // The frame of a word's last letter, leaving out letters the model wrote with the
    // window's end: those it writes because the audio stops, wherever that is.
    const writtenBy = (v: Visit): number => {
      const at = heard[v.lastHeard].letterAt;
      for (let n = at.length - 1; n >= 0; n--) {
        if (at[n] < frames - 3) return at[n];
      }
      return v.from;
    };
    // Is the ayah over? Its last word was said, and quiet followed.
    let lastSaid: Visit | undefined;
    let newestSaid: Visit | undefined;
    for (let k = visits.length - 1; k >= 0; k--) {
      const v = visits[k];
      if (v.text.part !== 'ayah' || v.kind === 'miss') continue;
      newestSaid ??= v;
      if (v.text.word === lastWord && !v.partial) {
        lastSaid = v;
        break;
      }
    }
    let over = isClosing;
    /** Model frame where the quiet after the ayah starts, when it is over. */
    let pauseAt = -1;
    /** Sound came between the ayah's last word and the long quiet that ended it. */
    let soundInPause = false;
    // The model writes a word's last letters as soon as the word has begun, so only
    // where the word starts is known: the quiet must come after that. A short gap
    // may be inside the word or already inside the next ayah, so only a long quiet
    // ends the ayah here. A reader who goes straight on is caught by the short window.
    // The ayah ends at the first pause after its last word. Sound between that pause
    // and the long quiet may be the next ayah's first word, said before a breath: the
    // next window starts at the first pause so as to hold it.
    if (!isClosing && lastSaid && lastSaid === newestSaid) {
      let firstPause = -1;
      for (const q of quiet) {
        // A slow reader's held sound can pass for quiet while the model is still
        // writing the word: the quiet counts from the last letter written.
        const early = Math.max(q.from, lastSaid.from + pauseFrames);
        if (firstPause < 0 && q.to - early >= pauseFrames) firstPause = early;
        const from = Math.max(early, writtenBy(lastSaid) + 1);
        if (q.to - from >= endFrames) {
          over = true;
          pauseAt = firstPause;
          soundInPause = firstPause !== from;
          break;
        }
      }
      // The model may write the last word before it is said, so its place moves
      // later as the word comes: the short window follows it.
      if (run >= seg.noHandoverUntil) {
        handover = {fromMel: Math.max(0, melOf(lastSaid.from) - 8)};
      }
    }
    // Quiet after a word inside the ayah: the reader has stopped there for now.
    let stoppedFor = 0;
    if (
      !over &&
      newestSaid &&
      newestSaid.nextHeard < 0 &&
      !newestSaid.partial
    ) {
      for (const q of quiet) {
        const from = Math.max(
          q.from,
          newestSaid.from + pauseFrames,
          writtenBy(newestSaid) + 1,
        );
        if (q.to >= frames - 1 && q.to - from > 0) {
          stoppedFor = (q.to - from) * FRAME_SECONDS;
        }
      }
    }

    // Later visits of the same word in this window: the reader went back. A visit
    // counts as a reading only if it is where the laying is sure of itself: a close
    // word, or a word beside a close one that is its neighbour in the text. A jump
    // back that lands on a far word is the laying's guess, not a reading.
    const close = (v: Visit | undefined, word: number, ayah: number) =>
      !!v &&
      v.text.part === 'ayah' &&
      v.text.ayah === ayah &&
      v.text.word === word &&
      v.kind === 'match' &&
      v.share <= config.anchorShare;
    const real = visits.map((v, k) => {
      if (v.text.part !== 'ayah') return false;
      if (close(v, v.text.word, v.text.ayah)) return true;
      return (
        close(visits[k - 1], v.text.word - 1, v.text.ayah) ||
        close(visits[k + 1], v.text.word + 1, v.text.ayah)
      );
    });
    const laterVisits = new Map<Visit, number>();
    const perKey = new Map<string, Visit[]>();
    const lastSaidAt = lastSaid ? visits.indexOf(lastSaid) : -1;
    if (lastSaid) seg.endedMel = melOf(lastSaid.at);
    // What comes after the ayah's last word is the next ayah's speech, or a going
    // back that the next window will read: not a reading here. The model may have
    // dropped the ayah and gone on to the next one, whose first words can be this
    // ayah's too: then the last word is not in this run, and its place is remembered.
    const ended = seg.endedMel;
    const afterEnd = (v: Visit, k: number) =>
      lastSaidAt >= 0
        ? k > lastSaidAt
        : ended !== null && melOf(v.from) > ended;
    visits.forEach((v, k) => {
      if (!real[k] || afterEnd(v, k)) return;
      const key = keyOf(v.text);
      const list = perKey.get(key);
      if (list) list.push(v);
      else perKey.set(key, [v]);
    });
    for (const [key, list] of perKey) {
      list.forEach((v, n) => laterVisits.set(v, list.length - 1 - n));
      const at = secondsOf(list[list.length - 1].from);
      const known = readings.get(key);
      if (!known) {
        readings.set(key, {reading: list.length - 1, at});
      } else if (at > known.at + 0.6) {
        // Started well after the newest reading known: new ones.
        let fresh = 0;
        for (const v of list) {
          if (secondsOf(v.from) > known.at + 0.6) fresh += 1;
        }
        readings.set(key, {reading: known.reading + fresh, at});
      } else if (at > known.at) {
        known.at = at;
      }
    }

    // An ayah left with no pause has its end cut where the next ayah's first word was
    // heard. Its last two words are still judged on that last look (judgeCutShort):
    // the rules below keep a cut that fell wrong from marking them.
    const endsInQuiet =
      !isClosing ||
      !closing?.byNext ||
      !!closing.paused ||
      config.judgeCutShort ||
      quiet.some(q => q.to >= frames - 1 && q.to - q.from >= pauseFrames);
    // Sound after the quiet that ended the ayah is the next ayah's, and the model may
    // write its first letters onto this ayah's last word. The last look, cut in that
    // quiet, judges the last words then.
    const soundAfterEnd =
      over && !isClosing && !quiet.some(q => q.to >= frames - 1);
    // Sound between the last word and the quiet that ended the ayah: the last words
    // cannot be told from it, here or on the last look.
    const unsureEnd = soundInPause || (isClosing && !!closing?.unsure);
    let missedRun = 0;
    let doubt = false;
    for (let k = 0; k < visits.length; k++) {
      const v = visits[k];
      missedRun = v.kind === 'miss' ? missedRun + 1 : 0;
      if (v.text.part !== 'ayah' || v.partial || !real[k]) continue;
      if (v.text.word < seg.judgeFrom || v.text.word < contextFrom) continue;
      // What comes after the ayah's last word in this window is the next ayah's
      // speech, or a going back that the next window will read: not judged here.
      if (afterEnd(v, k)) continue;
      const key = keyOf(v.text);
      const later = laterVisits.get(v) ?? 0;
      const reading = Math.max(0, (readings.get(key)?.reading ?? 0) - later);
      const id = `${key}#${reading}`;
      const known = decisions.get(id);
      if (known?.final) continue;
      // A word read again is judged on its newest reading.
      if (later > 0) {
        decisions.delete(id);
        continue;
      }
      const after =
        v.nextHeard >= 0
          ? (frames - heard[v.nextHeard].from) * FRAME_SECONDS
          : stoppedFor;
      // The audio after an ayah's last two words is soon the next ayah's, which
      // spoils their reading: they wait for the ayah's end.
      const nearEnd = v.text.word >= lastWord - 1;
      const ripeLive =
        !nearEnd &&
        (v.nextHeard >= 0
          ? after >= config.rightSeconds
          : stoppedFor >= config.midQuietSeconds);
      const ripe = over || ripeLive;
      const cutShort = over && !ripeLive && !endsInQuiet;
      const record = (
        verdict: LiveVerdict,
        final: boolean,
        gap: number,
        badRuns: number,
      ) => {
        decisions.set(id, {
          surah: v.text.surah,
          ayah: v.text.ayah,
          word: v.text.word,
          totalWords: v.text.totalWords,
          reading,
          verdict,
          final,
          letterShare: v.share,
          gap,
          audioFrom: secondsOf(v.from),
          audioTo: secondsOf(v.at + 1),
          badRuns,
        });
      };
      if (v.kind === 'match' && v.share === 0) {
        if (ripe) record('fine', true, 0, 0);
        else decisions.delete(id);
        continue;
      }
      // For the bench only: the score test on a word not yet ripe, to see what
      // judging it sooner would cost.
      const early =
        !ripe &&
        !!probe &&
        v.kind === 'match' &&
        v.nextHeard >= 0 &&
        !nearEnd &&
        after >= config.probeSeconds &&
        v.from >= 2;
      if (!ripe && !early) {
        decisions.delete(id);
        continue;
      }
      if (cutShort || ((soundAfterEnd || unsureEnd) && nearEnd)) {
        decisions.delete(id);
        continue;
      }
      // A word begun, dropped and said again: the model's letters around the break
      // are not to be trusted. Nor are they on a word the model is known to misread.
      if (v.restarted || deps.blind?.(v.text.surah, v.text.ayah, v.text.word)) {
        decisions.delete(id);
        continue;
      }
      // Words run together or cut in two: fine when the letters are right, and no
      // opinion when they are not.
      if (v.kind === 'join' || v.kind === 'split') {
        if (v.share === 0) record('fine', true, 0, 0);
        else decisions.delete(id);
        continue;
      }
      const missed = v.kind === 'miss';
      // Too many left out in a row is a jump, and a word left out at the very end
      // of an ayah is the follower's junction check's to find.
      if (missed && (missedRun > config.maxMissedRun || v.i >= heard.length)) {
        decisions.delete(id);
        continue;
      }
      // A word missing before the first word heard: only if the window shows quiet
      // before that word, or the cut may have taken it.
      if (missed && !visits.slice(0, k).some(x => x.kind !== 'miss')) {
        const first = heard[v.i].from;
        const led = quiet.some(
          q => q.from <= 1 && q.to >= 3 && q.to <= first + 1,
        );
        if (!led) {
          decisions.delete(id);
          continue;
        }
      }
      // A word that starts with the window: the cut, or the mic's start, may have
      // taken part of it, or left part of another in it. A word whose last letter
      // came with the window's end: the model may still be writing it.
      if (!missed && (v.from < 2 || frames - 1 - heard[v.lastHeard].at < 3)) {
        decisions.delete(id);
        continue;
      }
      // What was heard is a word of the ayah before or the ayah after: then it is
      // the check's place that is in doubt, and the follower's marks cover a reader
      // who mixed the two.
      if (!missed && nearby(seg).some(w => sameWord(w, heard[v.i].ids))) {
        decisions.delete(id);
        continue;
      }
      // Sound words on both sides, or it is the model that is lost here.
      const anchored = anchoredAt(
        visits,
        k,
        {lead: seg.cleanStart || planned.from === 0, end: over && endsInQuiet},
        config.runWords,
      );
      const letters = v.text.ids.length;
      let forced: number[];
      let optional: ReadonlySet<number>;
      if (missed) {
        const at = heard[v.i].tokFrom;
        forced = [
          ...tokens.slice(0, at),
          ...v.text.ids,
          SEP,
          ...tokens.slice(at),
        ];
        optional = new Set([at + letters]);
      } else {
        const h = heard[v.i];
        forced = [
          ...tokens.slice(0, h.tokFrom),
          ...v.text.ids,
          ...tokens.slice(h.tokTo),
        ];
        optional = new Set();
      }
      const gap = -pathScore(rel, frames, forced, optional);
      const need = missed
        ? Math.min(config.missedGap, config.missedGapPerLetter * letters)
        : Math.min(config.changedGap, config.changedGapPerLetter * letters);
      const strong = gap >= need && (missed || v.share >= config.changedShare);
      const bad = strong && anchored;
      const badRuns = bad ? (known?.badRuns ?? 0) + 1 : 0;
      // A very wide gap settles it at once. A narrower one must hold on a second
      // run, whichever window that run reads.
      const settled =
        bad &&
        (badRuns >= config.persistRuns || gap >= need * config.strongTimes);
      probe?.({
        run,
        key,
        reading,
        kind: missed ? 'missed' : 'changed',
        letters,
        share: v.share,
        gap,
        after,
        over,
        anchored,
        outcome: early
          ? 'early'
          : !strong
            ? 'weak'
            : anchored
              ? 'bad'
              : 'unanchored',
        closing: isClosing,
        final: settled && !early,
        heard: missed ? [] : [...heard[v.i].ids],
        written: [...v.text.ids],
        around: [-2, -1, 1, 2].map(away => {
          const o = visits[k + away];
          return o &&
            o.text.part === 'ayah' &&
            o.text.ayah === v.text.ayah &&
            o.text.word === v.text.word + away &&
            o.kind === 'match' &&
            !o.partial
            ? o.share
            : -1;
        }) as [number, number, number, number],
        lead: seg.cleanStart || planned.from === 0,
        end: over && endsInQuiet,
      });
      if (early) {
        decisions.delete(id);
        continue;
      }
      if (!bad) {
        decisions.delete(id);
        continue;
      }
      if (!settled && over) doubt = true;
      record(missed ? 'missed' : 'changed', settled, gap, badRuns);
    }

    // Where the reader goes next.
    if (isClosing) {
      segment = closing?.next ?? null;
      closing = null;
    } else if (over) {
      // A long quiet after the last word. With a word in doubt, or sound already back,
      // the ayah gets its last look alone; otherwise this run was that look.
      const next = nextAfter(seg, melOf(pauseAt + 2), true);
      // With sound in the pause the check cannot tell whose it is: the next ayah's
      // first words are then context only.
      if (next) next.cleanStart = !soundInPause;
      const soundBack = !quiet.some(q => q.to >= frames - 1);
      handover = null;
      if (doubt || soundBack) {
        closing = {
          segment: seg,
          endMel: melOf(pauseAt + pauseFrames + 2),
          next,
          byNext: false,
          unsure: soundInPause,
        };
        segment = null;
      } else {
        dropWaiting();
        segment = next;
      }
    } else {
      // Has the model itself gone on to the next ayah, or the follower?
      const moved = visits.find(
        v =>
          v.text.part === 'next' &&
          v.kind === 'match' &&
          v.share <= config.anchorShare &&
          !v.partial,
      );
      const followerOn =
        !!place && place.surah === seg.surah && place.ayah === seg.ayah + 1;
      seg.onward = followerOn ? seg.onward + 1 : 0;
      // With no word of this ayah heard, the model's word is enough, unless the next
      // ayah opens like this one: then only the follower can tell the two apart.
      const nextWords = lettersOf(seg.surah, seg.ayah + 1);
      const twinOpening =
        !!nextWords &&
        nextWords.length > 0 &&
        sameWord(nextWords[0], seg.words[0]);
      if (
        moved &&
        moved.text.word === 0 &&
        (followerOn || (!newestSaid && !twinOpening))
      ) {
        const first = heard[moved.i];
        const before = moved.i > 0 ? heard[moved.i - 1].from + pauseFrames : 0;
        const edge = melOf(Math.max(before, first.from - 3));
        const next = nextAfter(seg, edge, true);
        if (handover) {
          // The last word was heard: the ayah still gets its last look.
          closing = {
            segment: seg,
            endMel: Math.round(edge),
            next,
            byNext: true,
          };
          segment = null;
        } else {
          dropWaiting();
          segment = next;
        }
        handover = null;
      } else if (seg.onward >= config.onwardRuns && newestSaid && !handover) {
        // The follower has gone on and this window never saw the ayah end: start
        // after the last quiet stretch, or just after the last word heard.
        let edge = newestSaid.at + 6;
        let fixed = false;
        for (const q of quiet) {
          if (
            q.from > newestSaid.from &&
            q.to < frames &&
            q.to - q.from >= pauseFrames
          ) {
            edge = Math.max(q.from + 1, q.to - 3);
            fixed = true;
          }
        }
        dropWaiting();
        // Where the next ayah started is a guess here: its first words are context.
        segment = nextAfter(seg, melOf(edge), fixed);
        if (segment) segment.cleanStart = false;
      }
    }
    // The follower sits elsewhere for long: look for the place again.
    if (segment && place && segment === seg) {
      const off =
        place.surah !== segment.surah ||
        place.ayah < segment.ayah - 1 ||
        place.ayah > segment.ayah + 1;
      segment.drift = off ? segment.drift + 1 : 0;
      if (segment.drift >= config.driftRuns) forget();
    }
    prune(secondsOf(0));
    return opinionsIn(planned);
  };

  // Readings are kept for the whole take: a word's reading number never goes back.
  const prune = (windowStart: number) => {
    for (const [id, d] of decisions) {
      if (d.audioTo < windowStart - 30) decisions.delete(id);
    }
  };

  /** The segment for the ayah after this one, which may turn out to be this one again. */
  const nextAfter = (seg: Segment, mel: number, fixed: boolean) =>
    newSegment(seg.surah, seg.ayah + 1, mel, fixed, seg.ayah);

  /**
   * The short window: the ayah's last word, then whatever follows. When the next
   * ayah's first word shows, the ayah ends in the quietest place before it.
   */
  const watchForNext = (
    seg: Segment,
    planned: LivePlan,
    heard: readonly Heard[],
    quiet: readonly {from: number; to: number}[],
    frames: number,
  ): void => {
    const next = lettersOf(seg.surah, seg.ayah + 1);
    if (!next || heard.length < 2) return;
    const last = seg.words[seg.words.length - 1];
    const text = [last, ...next.slice(0, 4)];
    const steps = matchWords(heard, text, true, false, config);
    if (dbg) {
      dbg(
        `run ${run} handover ${seg.surah}:${seg.ayah} mel=${planned.from}-${
          planned.to
        } frames=${frames} quiet=[${quiet
          .map(q => `${q.from.toFixed(0)}-${q.to.toFixed(0)}`)
          .join(' ')}] heard=[${heard
          .map(h => `${h.ids.length}@${h.from}-${h.at}`)
          .join(' ')}] steps=[${steps
          .map(st =>
            st.kind === 'extra'
              ? `x${st.i}`
              : st.kind === 'again'
                ? `a${st.i}`
                : `${st.kind === 'miss' ? '-' : st.kind[0]}${st.i}>${st.j}${
                    'share' in st && st.share > 0
                      ? `(${st.share.toFixed(2)})`
                      : ''
                  }`,
          )
          .join(' ')}]`,
      );
    }
    // The next ayah's first word, heard close to its letters, with a second word after
    // it or the follower already there. A fast reader may run the last word and the
    // next ayah's first into one: then the place is read from the letters.
    const followerOn =
      !!place && place.surah === seg.surah && place.ayah === seg.ayah + 1;
    const second = steps.some(
      st => st.kind === 'match' && st.j === 2 && st.share <= config.anchorShare,
    );
    let start = -1;
    let floor = 0;
    for (const st of steps) {
      if (st.kind === 'match' && st.j === 1 && st.share <= config.anchorShare) {
        const isNewest = st.i === heard.length - 1;
        if (isNewest && !followerOn) return;
        start = heard[st.i].from;
        floor = st.i > 0 ? heard[st.i - 1].from + pauseFrames : 0;
        break;
      }
      if (st.kind === 'join' && st.j === 0 && st.share <= config.anchorShare) {
        if (!second) return;
        const h = heard[st.i];
        const at = Math.min(last.length, h.letterAt.length - 1);
        start = h.letterAt[at];
        floor = h.from + pauseFrames;
        break;
      }
    }
    // An ayah begun at its second word, after a pause: two words heard right, with
    // the first left out. The long window then says whether it was.
    let skipped = false;
    if (start < 0 && config.handoverSkipFirst && next.length >= 4) {
      const at = (j: number) =>
        steps.find(st => st.kind === 'match' && st.j === j && st.share === 0);
      const one = at(2);
      const two = at(3);
      const none = steps.some(st => st.kind === 'miss' && st.j === 1);
      if (one && two && none && two.i === one.i + 1) {
        start = heard[one.i].from;
        floor = one.i > 0 ? heard[one.i - 1].from + pauseFrames : 0;
        skipped = true;
      }
    }
    if (start < 0) return;
    if (!skipped && !second && !followerOn) return;
    // Cut in the quiet that ends at the word, or just before the word. Never more than
    // half a second before it: a longer quiet is the long window's to see.
    let edge = start - 3;
    let paused = false;
    let pauseEnd = -1;
    for (const q of quiet) {
      if (q.to <= start + 2 && q.to >= start - 6) {
        edge = Math.max(q.from + 1, q.to - 4);
        paused = q.to - q.from >= pauseFrames;
        pauseEnd = Math.min(q.to, start - 1);
      }
    }
    if (skipped && !paused) return;
    edge = Math.max(floor, start - 12, Math.min(edge, start - 2));
    const melOf = (frame: number) => planned.from + frame * MEL_PER_FRAME;
    const after = nextAfter(seg, melOf(edge), true);
    if (after) {
      after.cleanStart = paused || config.trustHandover;
      after.found = !skipped;
    }
    // The ayah's last look keeps the pause, when there is one: the model reads an
    // ayah's last word best with quiet after it.
    closing = {
      segment: seg,
      endMel: Math.round(melOf(paused ? Math.max(edge, pauseEnd - 1) : edge)),
      next: after,
      byNext: true,
      paused,
    };
    handover = null;
    segment = null;
  };

  /** Every opinion whose reading is still in the window. */
  const opinionsIn = (planned: LivePlan): LiveOpinion[] => {
    const start = planned.from / MEL_PER_SECOND;
    const out: LiveOpinion[] = [];
    for (const d of decisions.values()) {
      if (d.audioTo < start) continue;
      out.push({
        surah: d.surah,
        ayah: d.ayah,
        word: d.word,
        totalWords: d.totalWords,
        verdict: d.verdict,
        final: d.final,
        evidence: {
          letterShare: d.letterShare,
          gap: d.gap,
          audioFrom: d.audioFrom,
          audioTo: d.audioTo,
          reading: d.reading,
        },
      });
    }
    return out;
  };

  return {
    setPlace(next) {
      if (place && place.surah !== next.surah) forget();
      place = next;
    },
    relocated(at, audioTime) {
      forget();
      active = true;
      lock = {
        surah: at.surah,
        ayah: at.ayah,
        word: at.word,
        mel: Math.max(0, Math.round(audioTime * MEL_PER_SECOND) - windowMel),
      };
    },
    lost() {
      forget();
      active = false;
    },
    plan,
    step,
  };
}

/**
 * A word may be called bad only between words that were heard right. A reader who
 * leaves a word out or says another often spoils the word beside it too, so the test
 * is on the run of words around this one that did not read right: the run may be
 * `maxRun` written words at most, the written words just before and just after it
 * must have been heard letter for letter, and a run of more than one word needs a
 * second such word on one side. A run that starts the ayah needs two sound words
 * after it and a window that starts in a pause, with it; one that ends the ayah needs two
 * before it and the ayah's end: quiet after it, or its last look. Otherwise it is the
 * model that is lost
 * here, or the laying's guess after a jump back, or the check's own cut, not the
 * reader.
 */
function anchoredAt(
  visits: readonly Visit[],
  k: number,
  edges: {lead: boolean; end: boolean},
  maxRun: number,
): boolean {
  const v = visits[k];
  const here = (o: Visit | undefined): o is Visit =>
    !!o && o.text.part === 'ayah' && o.text.ayah === v.text.ayah;
  const sound = (o: Visit | undefined): o is Visit =>
    here(o) && o.kind !== 'miss' && o.share === 0 && !o.partial;
  let a = k;
  while (
    here(visits[a - 1]) &&
    !sound(visits[a - 1]) &&
    visits[a - 1].text.word === visits[a].text.word - 1
  ) {
    a -= 1;
  }
  let b = k;
  while (
    here(visits[b + 1]) &&
    !sound(visits[b + 1]) &&
    visits[b + 1].text.word === visits[b].text.word + 1
  ) {
    b += 1;
  }
  const first = visits[a].text.word;
  const last = visits[b].text.word;
  if (last - first + 1 > maxRun) return false;
  const soundAt = (o: Visit | undefined, word: number) =>
    sound(o) && o.text.word === word;
  const before1 = soundAt(visits[a - 1], first - 1);
  const before2 = before1 && soundAt(visits[a - 2], first - 2);
  const after1 = soundAt(visits[b + 1], last + 1);
  const after2 = after1 && soundAt(visits[b + 2], last + 2);
  const startsAyah = first === 0;
  const endsAyah = last === v.text.totalWords - 1;
  if (startsAyah && endsAyah) return false;
  // A run that starts the ayah must start the window too: with other words heard
  // before it the window holds more than this ayah, and the model reads one.
  if (startsAyah) return edges.lead && visits[a].i === 0 && after2;
  if (endsAyah) return edges.end && before2;
  if (a === b) return before1 && after1;
  return before1 && after1 && (before2 || after2);
}
