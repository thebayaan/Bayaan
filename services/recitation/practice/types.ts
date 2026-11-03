import type {ExpectedPassage} from '@tilawa/core';
import type {ShownFlag} from '../flags';
import type {TakeAyah} from '../take';

/** What a practice take asks the reader to recite. */
export interface PracticeTarget {
  /** The passage to recite (one surah). Null in tracking mode. */
  expected: ExpectedPassage | null;
  /** 'correction' checks the passage; 'tracking' only places the recitation. */
  mode: 'correction' | 'tracking';
  /** Tracking targets: which ayat answer it. Default: inside `expected`. */
  accept?: readonly string[];
  /** Nothing placed for this long ends the take. Default 25 s. */
  timeoutMs?: number;
}

export type PracticeOutcome =
  | 'clean'
  | 'flagged'
  | 'partial'
  | 'other'
  | 'nothing';

export interface PracticeVerdict {
  outcome: PracticeOutcome;
  flags: ShownFlag[];
  recited: TakeAyah[];
}
