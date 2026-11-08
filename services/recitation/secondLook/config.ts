// The last check before a word turns red. A second small model (quran-asr-small, a
// Conformer CTC that writes letters) hears a word the follower has doubts about, as
// the frozen rule says: scripts/second-look/RULE.md has every step and number.
//
// - The second judge scores the word on a slice inside its ayah, one chunk after the
//   verdict. It can make a mark of a word another word stands on, or of a word left
//   out, and it can drop a word that fits.
// - The cancel step looks at each mark about to show. It keeps a word scoring very
//   low, and one where a padded look finds a spelling with one inner letter changed
//   that beats the written word. It cancels the rest.
//
// Any failure or timeout leaves the mark as it would have been. Nothing has run on a
// phone: the numbers in RULE.md are from the bench and rank rules, they predict no
// phone. Constants tuned on the follower's output are in followerConstants.npl.json.

/**
 * False turns the second model off: no model, no audio kept, no judge, no cancel step.
 * The junction check and the added-word mark need no second model and stay on: their
 * options are in recitationEngine.ts.
 */
export const SECOND_LOOK_ENABLED = true as boolean;

/**
 * What wakes the second judge. 1: wrong and skipped verdicts. 2: also unsure, and ok
 * with a low gop, or with no gop and some distance. 2 catches more changed words and
 * adds marks the cancel step may not touch: off until a phone session has measured it.
 */
export const JUDGE_STEP = 1 as 1 | 2;

export type CancelMayCancel = 'all' | 'skipped';

/**
 * What the cancel step may cancel: 'all' marks, or 'skipped' marks only. On a
 * development build the owner can choose on the phone, on the hidden spike screen:
 * that choice is saved, wins over this, and counts from the next take.
 */
export const CANCEL_MAY_CANCEL = 'all' as CancelMayCancel;

/** With no answer this long after the model was asked, the mark is shown. */
export const CHECK_TIMEOUT_MS = 2000;

/**
 * Slices that may wait their turn, one model run at a time. At 0.6 s a run this is
 * about what CHECK_TIMEOUT_MS can serve. A wake with no room fails open.
 */
export const CHECK_QUEUE_CAP = 4;

/**
 * The judge's own constants: set on quran-asr-small and the official text alone
 * (scripts/recitation-bench/judge/judge_constants.json), with no follower output. The
 * margin an alternative must win by came from the same table, but was fixed after the
 * follower's sweep had been seen, so it is in the NPL file (secondJudge.altMargin).
 */
export const JUDGE = {
  /** An alternative must itself score at least minus this. */
  altFit: 1,
  /** The expected word fits when it scores at least minus this. */
  fit: 2,
  /** No word here must beat the expected word by this, and fit as an alternative. */
  absentMargin: 10,
  leftWords: 2,
  rightWords: 0,
  /** The longest slice. */
  sliceSeconds: 8,
  /** A slice starts this long before the ayah's first word, */
  cutSeconds: 0.2,
  /** and ends this long after the next ayah's first word starts. */
  tailSeconds: 0.2,
  /** An ayah's first word must begin within this many model frames of the slice. */
  firstWithinFrames: 50,
};
