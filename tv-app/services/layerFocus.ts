/**
 * Focus that is asked for and then checked. Both focus engines can drop a
 * request without a word: on tvOS requestTVFocus only names a preferred
 * view and asks UIKit for an update, which it skips when that view is gone,
 * hidden or not focusable, and the native memory of an autoFocus guide can
 * point at a view that left the screen. When a request goes nowhere, the
 * remote's arrows have nothing to move from and Back is swallowed.
 *
 * So focus moves the app makes after a screen change (a layer uncovered, an
 * overlay closed, Back onto the sidebar) go through focusInSteps: try the
 * best target, wait a moment, and if focus has not arrived, try the next.
 * Pure (the scheduler is injected), so the order is unit-tested.
 */

/** A host view that can take TV focus (react-native-tvos View). */
export type FocusTarget = {
  requestTVFocus?: () => void;
  /** Set by the renderer where it can tell (Fabric's DOM-like nodes). */
  isConnected?: boolean;
};

/** How long a request has to land before the next step is tried. */
export const CONFIRM_MS = 150;

/** Asks `target` to take focus; false when there is nothing to ask. */
export function requestFocus(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const view = target as FocusTarget;
  if (view.isConnected === false) return false;
  if (typeof view.requestTVFocus !== 'function') return false;
  view.requestTVFocus();
  return true;
}

/**
 * Where focus is inside a part of the screen (a layer, the app), from the
 * focus and blur events that bubble up to its wrapper. Keyed by the event's
 * target, so either order of the old view's blur and the new view's focus
 * holds. Remembers the element focused last, for putting focus back there.
 */
export type FocusMemory = {
  focus: (target: unknown) => void;
  blur: (target: unknown) => void;
  /** Whether an element inside has focus now. */
  inside: () => boolean;
  /** The element focused last, while it can still take focus. */
  last: () => FocusTarget | null;
  /** Focus events seen so far: a change means focus arrived somewhere. */
  count: () => number;
};

export function createFocusMemory(): FocusMemory {
  let focused: unknown = null;
  let last: unknown = null;
  let seen = 0;
  return {
    focus: target => {
      if (target == null) return;
      seen += 1;
      focused = target;
      last = target;
    },
    blur: target => {
      if (target != null && focused === target) focused = null;
    },
    inside: () => focused !== null,
    last: () => {
      if (!last || typeof last !== 'object') return null;
      const view = last as FocusTarget;
      if (view.isConnected === false) return null;
      return typeof view.requestTVFocus === 'function' ? view : null;
    },
    count: () => seen,
  };
}

/** Runs `cb` after `ms`; returns the cancel. */
export type Schedule = (cb: () => void, ms: number) => () => void;

const timeoutSchedule: Schedule = (cb, ms) => {
  const id = setTimeout(cb, ms);
  return () => clearTimeout(id);
};

/**
 * Tries each step in turn until focus lands. A step returns false when it
 * has nothing to try (no remembered element, no sidebar), and the next one
 * runs at once; after a step that asked for focus, `landed` is checked once
 * CONFIRM_MS has passed, and only then does the next step run. Returns the
 * cancel (the screen changed again, or the layer was covered).
 */
export function focusInSteps(
  steps: ReadonlyArray<() => boolean>,
  landed: () => boolean,
  schedule: Schedule = timeoutSchedule,
): () => void {
  let cancel: (() => void) | null = null;
  let stopped = false;
  const run = (from: number): void => {
    let i = from;
    while (i < steps.length && !steps[i]()) i += 1;
    if (i >= steps.length) return;
    cancel = schedule(() => {
      cancel = null;
      if (stopped || landed()) return;
      run(i + 1);
    }, CONFIRM_MS);
  };
  run(0);
  return () => {
    stopped = true;
    cancel?.();
    cancel = null;
  };
}

/**
 * `landed` for a request made now: focus arrived after it (a new focus
 * event), or, with `orInside`, is already inside the part asked for. The
 * app-wide memory leaves `orInside` off: a focused view that unmounts (an
 * overlay's row) sends no blur, so "inside" can be stale there.
 */
export function landedSince(
  memory: FocusMemory,
  {orInside = true}: {orInside?: boolean} = {},
): () => boolean {
  const before = memory.count();
  return () => memory.count() !== before || (orInside && memory.inside());
}
