/**
 * Lets a screen take the remote's Back for something it has open (a panel, a
 * picker) before the Router goes back a place. The Router asks
 * `consumeScreenBack()` first; the newest handler that returns true wins.
 */
type Handler = () => boolean;

const handlers: Handler[] = [];

/** Registers `handler`; returns the function that removes it. */
export function pushScreenBack(handler: Handler): () => void {
  handlers.push(handler);
  return () => {
    const index = handlers.lastIndexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  };
}

/** True when a screen handled Back. */
export function consumeScreenBack(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]()) return true;
  }
  return false;
}
