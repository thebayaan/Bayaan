// @ai-generated
/**
 * The launch restore's background load (services/player/utils/restoreSession),
 * kept in its own module so the player store can wait for it without
 * importing restoreSession, which imports the store.
 */

let restoreLoad: Promise<void> | null = null;

/** Records the in-flight restore load; clears itself when it settles. */
export function trackRestoreLoad(load: Promise<void>): void {
  restoreLoad = load;
  const clear = (): void => {
    if (restoreLoad === load) restoreLoad = null;
  };
  load.then(clear, clear);
}

/** Resolves once the restore's background load (if any) has settled. */
export function pendingRestoreLoad(): Promise<void> {
  return restoreLoad ?? Promise.resolve();
}
