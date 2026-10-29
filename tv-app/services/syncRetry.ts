/**
 * A verse lookup that failed (offline, the CDN down) is tried again this
 * often while the player is open, and whenever the app comes back to the
 * front.
 */
export const SYNC_RETRY_MS = 30 * 1000;

/**
 * Runs `attempt` now, then again every SYNC_RETRY_MS and whenever
 * `onForeground` fires, until it reports success. Returns the cleanup.
 */
export function retryUntilDone(
  attempt: () => Promise<boolean>,
  onForeground?: (run: () => void) => () => void,
): () => void {
  let stopped = false;
  let busy = false;
  const run = (): void => {
    if (stopped || busy) return;
    busy = true;
    // A lookup that throws past its own handlers counts as not done yet,
    // rather than leave `busy` set and the retries stopped for good.
    attempt().then(
      done => {
        busy = false;
        if (done) stop();
      },
      () => {
        busy = false;
      },
    );
  };
  const timer = setInterval(run, SYNC_RETRY_MS);
  const unsubscribe = onForeground?.(run);
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    unsubscribe?.();
  };
  run();
  return stop;
}
