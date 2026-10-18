/**
 * Whether focus is somewhere inside a pane, from the focus and blur events
 * that bubble up to the pane's wrapper. Keyed by the event's target, so it
 * holds whichever order a platform sends the blur of the old view and the
 * focus of the new one in.
 */
export type FocusWithin = {
  focus: (target: number) => void;
  blur: (target: number) => void;
  /** Forget it (focus was moved elsewhere on purpose). */
  reset: () => void;
  inside: () => boolean;
};

export function createFocusWithin(): FocusWithin {
  let focused: number | null = null;
  return {
    focus: target => {
      focused = target;
    },
    blur: target => {
      if (focused === target) focused = null;
    },
    reset: () => {
      focused = null;
    },
    inside: () => focused !== null,
  };
}
