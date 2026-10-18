/**
 * Where focus goes back to when an overlay closes. A long-press on a card or
 * button notes the view it came from (FocusableCard / FocusableButton do this
 * on their own); the context menu takes that note when it opens and hands
 * focus back to the view when it closes, instead of leaving the focus engine
 * to pick a fallback (the sidebar on Android, the top of the screen on tvOS).
 */

/** A mounted view that can take TV focus (react-native-tvos View). */
export type FocusableView = {requestTVFocus?: () => void};
export type FocusRef = {readonly current: FocusableView | null};

/** A long-press older than this was not the one that opened the overlay. */
export const ORIGIN_TTL_MS = 1500;

let origin: {ref: FocusRef; at: number} | null = null;

/** Notes the view a long-press came from. */
export function noteLongPressOrigin(ref: FocusRef): void {
  origin = {ref, at: Date.now()};
}

/** The view the latest long-press came from, once; null when stale. */
export function takeLongPressOrigin(): FocusRef | null {
  const noted = origin;
  origin = null;
  if (!noted || Date.now() - noted.at > ORIGIN_TTL_MS) return null;
  return noted.ref;
}

let claimed = false;

/**
 * Called by a screen while the menu closes (from a contextMenuStore
 * subscriber) when it moves focus itself: the opener's tile was removed or
 * moved, and a recycled list cell may now hold another item.
 */
export function claimFocusReturn(): void {
  claimed = true;
}

/** Whether a screen claimed this close's focus; resets the claim. */
export function takeFocusClaim(): boolean {
  const was = claimed;
  claimed = false;
  return was;
}

const nextFrame: (cb: () => void) => void =
  typeof requestAnimationFrame === 'function'
    ? cb => {
        requestAnimationFrame(() => cb());
      }
    : cb => {
        setTimeout(cb, 16);
      };

/**
 * Focuses `ref` once the overlay has gone (next frame, after React removed
 * it), when the view is still mounted. A view that has left the screen (its
 * tile removed, the screen changed) is skipped.
 */
export function restoreFocusTo(ref: FocusRef | null): void {
  if (!ref) return;
  nextFrame(() => ref.current?.requestTVFocus?.());
}
