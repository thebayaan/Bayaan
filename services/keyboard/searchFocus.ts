// @ai-generated
/**
 * ⌘F opens the Search tab and puts the cursor in its field. The tab may not
 * be on screen yet when the key is pressed, so the request waits here until
 * the search screen is ready to take it.
 *
 * It only waits a few seconds. When the Search tab comes back showing a
 * screen opened from it (a reciter, a surah list), nothing takes the request.
 * It used to stay set, and the field took the cursor whenever the search
 * screen was next shown, minutes later.
 */
const REQUEST_LIFETIME_MS = 5000;

/** When the request still waiting was made, or null. */
let requestedAt: number | null = null;
const listeners = new Set<() => void>();

export function requestSearchFocus(): void {
  requestedAt = Date.now();
  listeners.forEach(listener => listener());
}

/** True once per request: the caller focuses the field. */
export function takeSearchFocusRequest(): boolean {
  const at = requestedAt;
  requestedAt = null;
  return at !== null && Date.now() - at < REQUEST_LIFETIME_MS;
}

export function subscribeSearchFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
