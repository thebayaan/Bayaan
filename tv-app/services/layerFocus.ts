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
 * holds. Remembers the elements focused last, for putting focus back there.
 */
export type FocusMemory = {
  focus: (target: unknown) => void;
  blur: (target: unknown) => void;
  /** Whether an element inside has focus now. */
  inside: () => boolean;
  /** The element focused last, while it can still take focus. */
  last: () => FocusTarget | null;
  /**
   * The elements focused last, newest first, that can still take focus.
   * When the newest has left the screen (a menu removed its card) the one
   * before it is where focus came from: next to it on the D-pad.
   */
  recent: () => FocusTarget[];
  /** Focus events seen so far: a change means focus arrived somewhere. */
  count: () => number;
};

/** How many elements a memory keeps (see recent). */
export const RECENT_FOCUS = 3;

function focusable(target: unknown): FocusTarget | null {
  if (!target || typeof target !== 'object') return null;
  const view = target as FocusTarget;
  if (view.isConnected === false) return null;
  return typeof view.requestTVFocus === 'function' ? view : null;
}

export function createFocusMemory(): FocusMemory {
  let focused: unknown = null;
  let recent: unknown[] = [];
  let seen = 0;
  return {
    focus: target => {
      if (target == null) return;
      seen += 1;
      focused = target;
      recent = [target, ...recent.filter(t => t !== target)].slice(
        0,
        RECENT_FOCUS,
      );
    },
    blur: target => {
      if (target != null && focused === target) focused = null;
    },
    // A focused view that unmounts sends no blur: it no longer counts.
    inside: () =>
      focused !== null && (focused as FocusTarget).isConnected !== false,
    last: () => focusable(recent[0]),
    recent: () =>
      recent.map(focusable).filter((v): v is FocusTarget => v !== null),
    count: () => seen,
  };
}

/** Runs `cb` after `ms`; returns the cancel. */
export type Schedule = (cb: () => void, ms: number) => () => void;

const timeoutSchedule: Schedule = (cb, ms) => {
  const id = setTimeout(cb, ms);
  return () => clearTimeout(id);
};

/** How often a chain's last request is asked again when it doesn't land. */
export const LAST_STEP_RETRIES = 3;

/**
 * Tries each step in turn until focus lands. A step returns false when it
 * has nothing to try (no remembered element, no sidebar), and the next one
 * runs at once; after a step that asked for focus, `landed` is checked once
 * CONFIRM_MS has passed, and only then does the next step run.
 *
 * With `retries`, the last request of the chain is itself checked: when no
 * later step has anything to try, it is asked again (up to `retries` times,
 * CONFIRM_MS apart), so a target that was still mounting gets its focus and
 * the chain never just ends with focus nowhere. Leave it at 0 when the last
 * step hands over to a chain of its own (restoring a layer), which checks
 * itself. Returns the cancel (the screen changed again, or the layer was
 * covered).
 */
export function focusInSteps(
  steps: ReadonlyArray<() => boolean>,
  landed: () => boolean,
  schedule: Schedule = timeoutSchedule,
  retries = 0,
): () => void {
  let cancel: (() => void) | null = null;
  let stopped = false;
  let retriesLeft = retries;
  const check = (i: number): void => {
    cancel = schedule(() => {
      cancel = null;
      if (stopped || landed()) return;
      if (run(i + 1)) return;
      // Nothing after it to try: ask the last request again.
      while (retriesLeft > 0) {
        retriesLeft -= 1;
        if (steps[i]()) {
          check(i);
          return;
        }
      }
    }, CONFIRM_MS);
  };
  // Runs from step `from`; false when no step had anything to ask.
  const run = (from: number): boolean => {
    let i = from;
    while (i < steps.length && !steps[i]()) i += 1;
    if (i >= steps.length) return false;
    check(i);
    return true;
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
