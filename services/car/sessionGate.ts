// Cold-start ordering between the app's session restore and car requests.
// Kept free of native imports so restoreSession and _layout can use it
// without pulling in the car module graph.

let restoredResolve: (() => void) | null = null;
let restored = false;
const restoredPromise = new Promise<void>(resolve => {
  restoredResolve = resolve;
});
let carOwnsQueue = false;

/** Call once restoreSession() has settled, whether it succeeded or failed. */
export function markSessionRestored(): void {
  if (restored) return;
  restored = true;
  restoredResolve?.();
}

/** Resolves once the session is restored, or after timeoutMs at the latest. */
export function waitForSessionRestored(timeoutMs: number): Promise<void> {
  if (restored) return Promise.resolve();
  return new Promise<void>(resolve => {
    const timer = setTimeout(resolve, timeoutMs);
    restoredPromise.then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** The car bridge calls this right before it replaces the player queue. */
export function markCarReplacedQueue(): void {
  carOwnsQueue = true;
}

/** True once a car request has replaced the queue; restore must not touch it. */
export function hasCarReplacedQueue(): boolean {
  return carOwnsQueue;
}
