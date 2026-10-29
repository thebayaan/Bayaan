// @ai-generated
/**
 * ⌘F opens the Search tab and puts the cursor in its field. The tab may not
 * be on screen yet when the key is pressed, so the request waits here until
 * the search screen is ready to take it.
 */
let pending = false;
const listeners = new Set<() => void>();

export function requestSearchFocus(): void {
  pending = true;
  listeners.forEach(listener => listener());
}

/** True once per request: the caller focuses the field. */
export function takeSearchFocusRequest(): boolean {
  const asked = pending;
  pending = false;
  return asked;
}

export function subscribeSearchFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
