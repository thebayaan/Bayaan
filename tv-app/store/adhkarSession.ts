// Pure rules of an adhkar reading session on the TV: where you are in the
// list, how many times each dhikr has been said, and when to move on. The
// controller (adhkarSessionController.ts) applies them and drives the audio.

export type SessionState = {
  listId: string;
  /** Times each dhikr is said, in list order (at least 1 each). */
  targets: readonly number[];
  /** Times each dhikr has been said so far. */
  counts: readonly number[];
  index: number;
  /** Every dhikr is done; the reader shows the closing card. */
  finished: boolean;
};

export function startSession(
  listId: string,
  targets: readonly number[],
  index = 0,
): SessionState {
  const safe = targets.map(t => Math.max(1, Math.floor(t) || 1));
  return {
    listId,
    targets: safe,
    counts: safe.map(() => 0),
    index: clampIndex(index, safe.length),
    finished: false,
  };
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(length - 1, index));
}

export function currentTarget(state: SessionState): number {
  return state.targets[state.index] ?? 1;
}

export function currentCount(state: SessionState): number {
  return state.counts[state.index] ?? 0;
}

/** Whether the current dhikr has been said as many times as it should be. */
export function isCurrentComplete(state: SessionState): boolean {
  return currentCount(state) >= currentTarget(state);
}

/** Says the current dhikr once more (never past its count). */
export function countOne(state: SessionState): SessionState {
  if (state.finished || state.targets.length === 0) return state;
  const target = currentTarget(state);
  const count = currentCount(state);
  if (count >= target) return state;
  const counts = state.counts.slice();
  counts[state.index] = count + 1;
  return {...state, counts};
}

/** Moves to the next dhikr, or finishes the session after the last one. */
export function next(state: SessionState): SessionState {
  if (state.finished || state.targets.length === 0) return state;
  if (state.index >= state.targets.length - 1) {
    return {...state, finished: true};
  }
  return {...state, index: state.index + 1};
}

/** Moves to the previous dhikr; from the closing card, back to the last. */
export function prev(state: SessionState): SessionState {
  if (state.finished) return {...state, finished: false};
  if (state.index === 0) return state;
  return {...state, index: state.index - 1};
}

export function goTo(state: SessionState, index: number): SessionState {
  if (state.targets.length === 0) return state;
  return {
    ...state,
    index: clampIndex(index, state.targets.length),
    finished: false,
  };
}

/** Starts the list over with every count cleared. */
export function restart(state: SessionState): SessionState {
  return startSession(state.listId, state.targets, 0);
}

export type PressResult = {
  state: SessionState;
  /** The dhikr is now complete: move on after a short beat. */
  advance: boolean;
};

/**
 * OK on the reader: counts one. Reaching the count (or pressing on a dhikr
 * already complete, or one said once) asks the controller to move on.
 */
export function press(state: SessionState): PressResult {
  if (state.finished || state.targets.length === 0) {
    return {state, advance: false};
  }
  if (isCurrentComplete(state)) return {state, advance: true};
  const counted = countOne(state);
  return {state: counted, advance: isCurrentComplete(counted)};
}

export type TrackEndAction = 'replay' | 'advance' | 'stop';

/**
 * What happens as a recitation ends: `off` stops there, `count` counts it
 * as one saying and replays the dhikr until its count is reached ("Count
 * each for me", and Auto-advance), `once` counts it and moves straight on
 * ("Listen through": every dhikr heard once, in order).
 */
export type AdvanceMode = 'off' | 'count' | 'once';

/**
 * A recitation finished. `alreadyCounted` is set when the listener pressed
 * OK while it played, so one recitation is never counted twice.
 */
export function trackEnded(
  state: SessionState,
  mode: AdvanceMode | boolean,
  alreadyCounted = false,
): {state: SessionState; action: TrackEndAction} {
  const advance = mode === true ? 'count' : mode === false ? 'off' : mode;
  if (advance === 'off' || state.finished) return {state, action: 'stop'};
  const counted = alreadyCounted ? state : countOne(state);
  if (advance === 'once') return {state: counted, action: 'advance'};
  return {
    state: counted,
    action: isCurrentComplete(counted) ? 'advance' : 'replay',
  };
}

/** Whether a list reopened part way: past the first dhikr or with counts. */
export function isUnderway(state: SessionState): boolean {
  return !state.finished && (state.index > 0 || state.counts.some(c => c > 0));
}

/** Adhkar finished so far (complete counts), for the progress line. */
export function completedCount(state: SessionState): number {
  return state.counts.filter((c, i) => c >= (state.targets[i] ?? 1)).length;
}
