import type {EngineWord} from '../wordMarks';

// The live check: the second model (quran-asr-small) re-reads the last few seconds
// about twice a second and says, for each word it has heard enough of, whether the
// written word was said. It does not wait for the follower to doubt a word. The
// follower only tells it roughly where the reader is, so it knows which text to
// expect; it finds every cut in the audio itself.
//
// This file is the contract between the check (check.ts, pure: no native code, runs
// under node on the bench) and the app's side of it (runner.ts, liveMarks.ts, the
// tracking service).

/**
 * 'missed': the word was not said. 'changed': something else was said in its place.
 * 'fine': the written word was said.
 */
export type LiveVerdict = 'missed' | 'changed' | 'fine';

/** The two tests behind an opinion, and where the reading sits in the take. */
export interface LiveEvidence {
  /**
   * Test A, on letters: the share of the written word's letters that the model's own
   * reading of those frames differs by, 0 to 1. 1 for a word with no reading at all.
   */
  letterShare: number;
  /**
   * Test B, on scores: nats by which the best other account of the same frames
   * (another word, or no word) beats the written word. 0 when the written word is
   * what the model would say anyway.
   */
  gap: number;
  /** The reading's place in the take's audio, in seconds since the reset. */
  audioFrom: number;
  audioTo: number;
  /**
   * 0 for the first time this word is read in the take, 1 for a re-reading, and so
   * on. It never goes back within a take, whatever the follower loses or finds.
   */
  reading: number;
}

/** What one run says about one reading of one word (engine word numbers, 0-based). */
export interface LiveOpinion extends EngineWord {
  totalWords: number;
  verdict: LiveVerdict;
  /**
   * The check will not change its mind about this reading. Only a final opinion may
   * make, keep or correct a mark. A final opinion is sent again on each later run while
   * its word is still in the window, so applying it twice must change nothing.
   */
  final: boolean;
  evidence: LiveEvidence;
}

/** The log-mel frames a run wants: [from, to), 100 a second from 0 at the reset. */
export interface LivePlan {
  from: number;
  to: number;
  /** Names the plan for step(). */
  id: number;
}

/** The follower's cursor: the word it heard most recently. */
export interface LivePlace extends EngineWord {
  totalWords: number;
}

export interface LiveCheck {
  /**
   * The follower's rough place. It says which text to expect and nothing else: no cut
   * in the audio is ever taken from it.
   */
  setPlace: (place: LivePlace) => void;
  /**
   * The follower locked or relocated onto this word at this audio time (seconds).
   * Nothing heard before it is read as a continuation, and no word before it is judged.
   */
  relocated: (place: EngineWord, audioTime: number) => void;
  /** The follower lost the reader or went idle: what was pending goes, until the next lock. */
  lost: () => void;
  /**
   * The frames to read now, or null when there is nothing more to do this tick. A
   * tick may hold up to three windows (the ayah so far, a short one that watches for
   * the next ayah, and an ayah's last look): after step(), ask again with the same
   * `heard` until null. A plan never reaches back more than the ten seconds the
   * stream keeps. A plan the app could not run (a short read, a failed run) is simply
   * dropped: step() need not be called for it.
   * @param heard - Log-mel frames the stream holds so far (the end, exclusive)
   */
  plan: (heard: number) => LivePlan | null;
  /**
   * The model's output for a plan's frames: [frames, 31] log-probabilities row by row.
   * Returns this run's opinions. A plan that is no longer the newest returns none.
   * @param energy - The mean of each of the plan's log-mel frames, one value a frame:
   *   how the check hears the quiet around an ayah. Without it an ayah's end is seen
   *   only when the next ayah's first word is.
   */
  step: (
    plan: LivePlan,
    logp: Float32Array,
    frames: number,
    energy?: Float32Array,
  ) => LiveOpinion[];
}

/** What the check reads from the app. */
export interface LiveDeps {
  /**
   * An ayah's words as the model writes them (ayahLetters), or null for an ayah that
   * has none to give: the check skips that ayah whole, and picks up at the next.
   */
  letters: (surah: number, ayah: number) => readonly string[] | null;
  /** How many ayat a surah has. */
  ayahCount: (surah: number) => number;
  /**
   * A word the model is known to misread when it is read right (blindSpots.json). The
   * check never calls such a word bad; it can still call it fine.
   */
  blind?: (surah: number, ayah: number, word: number) => boolean;
}
