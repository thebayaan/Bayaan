/**
 * Audio focus between the TV's audio engines.
 *
 * The Quran player and the adhkar reader each own an AudioEngine, but on
 * tvOS and Android TV both wrap the one expo-audio player. Whichever engine
 * loads a track takes focus; the engine that held it is told to step aside
 * (stop reporting the other engine's playback as its own, and remember where
 * it was so it can pick up again). With one engine nothing changes.
 */

export type AudioFocusOwner = {
  /** Called once when another owner takes focus from this one. */
  onFocusLost: () => void;
};

let current: AudioFocusOwner | null = null;

/** Takes focus for `owner`, telling the previous owner it lost it. */
export function claimAudioFocus(owner: AudioFocusOwner): void {
  if (current === owner) return;
  const previous = current;
  current = owner;
  previous?.onFocusLost();
}

/** Gives focus up if `owner` holds it; nobody holds it afterwards. */
export function releaseAudioFocus(owner: AudioFocusOwner): void {
  if (current === owner) current = null;
}

/** Whether another owner holds focus (false when nobody does). */
export function audioFocusHeldByOther(owner: AudioFocusOwner): boolean {
  return current !== null && current !== owner;
}

/** Test helper: forget the current owner. */
export function resetAudioFocusForTests(): void {
  current = null;
}
