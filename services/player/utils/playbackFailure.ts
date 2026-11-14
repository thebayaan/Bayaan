// @ai-generated
/**
 * A track could not be loaded or played. The player store reports it here
 * and the audio provider tells the user, so the store stays free of UI
 * imports.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function onPlaybackFailed(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reportPlaybackFailed(): void {
  listeners.forEach(listener => listener());
}
