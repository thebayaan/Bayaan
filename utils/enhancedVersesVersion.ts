// @ai-generated
/**
 * Counts rebuilds of the shared verse data (utils/enhancedVerseData).
 *
 * Applying a translation replaces every surah's verse array. Screens that
 * hold on to verse objects (the reader's list views, the player's verse
 * list) read this number so they take the new arrays; without it they kept
 * showing the previous translation's text under the new one's name.
 *
 * Its own module so the data module stays free of React, and so a test that
 * replaces the data module still gets a working hook.
 */
import {useSyncExternalStore} from 'react';

let version = 0;
const listeners = new Set<() => void>();

export function getEnhancedVersesVersion(): number {
  return version;
}

/** Called by enhancedVerseData each time it has replaced the verse arrays. */
export function notifyEnhancedVersesRebuilt(): void {
  version += 1;
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The rebuild count; the caller re-renders when the data is rebuilt. */
export function useEnhancedVersesVersion(): number {
  return useSyncExternalStore(
    subscribe,
    getEnhancedVersesVersion,
    getEnhancedVersesVersion,
  );
}
