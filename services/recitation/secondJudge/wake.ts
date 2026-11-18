// What wakes the second judge. Bursts never reach this: the lock-chunk and
// realignment filters run first (RecitationTrackingService).
import followerConstants from '../followerConstants.npl.json';
import {JUDGE_STEP} from '../secondLook/config';
import type {VerdictChange, VerdictState} from '../wordMarks';

const {wakeStep1, wakeStep2, wakeOkGop, wakeOkNoGop} =
  followerConstants.secondJudge;

/** Step 1 wakes on this verdict. Any other wake is Step 2's alone. */
export function wakesAtStep1(state: VerdictState): boolean {
  return wakeStep1.includes(state);
}

export function wakesSecondJudge(
  change: VerdictChange,
  step2: boolean = JUDGE_STEP === 2,
): boolean {
  // News about a word is no new verdict, and a junction mark takes no answer.
  if (change.repeat || change.detail?.junctionMissing === true) return false;
  if (wakesAtStep1(change.state)) return true;
  if (!step2) return false;
  if (wakeStep2.includes(change.state)) return true;
  if (change.state !== 'ok') return false;
  const gop = change.detail?.gop;
  if (typeof gop === 'number') return gop <= wakeOkGop;
  return wakeOkNoGop && (change.detail?.distance ?? 0) > 0;
}
