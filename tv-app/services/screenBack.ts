/**
 * Lets a screen take the remote's Back for something it has open (a panel, a
 * picker) before the Router goes back a place. The Router asks
 * `consumeScreenBack()` first; the newest handler that returns true wins.
 *
 * Screens under a stacked screen stay mounted (see Router), so a handler
 * belongs to the layer that registered it: the stack depth at the time. Only
 * the showing layer's handlers are asked, so Search's open picker never eats
 * a Back meant for the player stacked over it.
 */
import {useNavStore} from '../store/navStore';

type Handler = () => boolean;
type Entry = {handler: Handler; layer: number};

const entries: Entry[] = [];
const listeners = new Set<() => void>();

function currentLayer(): number {
  return useNavStore.getState().stack.length;
}

function changed(): void {
  listeners.forEach(l => l());
}

/** Registers `handler`; returns the function that removes it. */
export function pushScreenBack(handler: Handler): () => void {
  const entry: Entry = {handler, layer: currentLayer()};
  entries.push(entry);
  changed();
  return () => {
    const index = entries.lastIndexOf(entry);
    if (index < 0) return;
    entries.splice(index, 1);
    changed();
  };
}

/** True when a screen on the showing layer handled Back. */
export function consumeScreenBack(): boolean {
  const layer = currentLayer();
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.layer === layer && entry.handler()) return true;
  }
  return false;
}

/** How many handlers the showing layer has (Back is taken while any are). */
export function screenBackCount(): number {
  const layer = currentLayer();
  return entries.filter(e => e.layer === layer).length;
}

/** Calls `listener` whenever a handler is added or removed. */
export function subscribeScreenBack(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
