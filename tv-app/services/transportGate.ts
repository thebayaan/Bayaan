/**
 * One transport press, one action.
 *
 * On Vega a remote transport key can reach the app twice: as a key event
 * (useTVEventHandler) and as a media-control command from the system (the
 * handler in services/audioEngine.kepler.ts). Each path acts on playback, so
 * if both arrived Play/Pause would undo itself, and Fast-forward, Rewind,
 * Next and Previous would act twice. Every such command from either path
 * claims its channel first; a claim from the other path on the same channel
 * within GATE_MS of the last one is the same press and is dropped. Presses
 * from the same path always pass, so quick repeated presses still work, and
 * the channels never block each other.
 *
 * Elsewhere only key events exist and every claim passes.
 */

export type TransportSource = 'key' | 'system';

/** What a press does: toggle, seek within the surah, or change surah. */
export type TransportChannel = 'playPause' | 'seek' | 'track';

export const GATE_MS = 600;

const last = new Map<TransportChannel, {source: TransportSource; at: number}>();

export function claimTransport(
  source: TransportSource,
  channel: TransportChannel = 'playPause',
  now: number = Date.now(),
): boolean {
  const previous = last.get(channel);
  if (previous && previous.source !== source && now - previous.at < GATE_MS) {
    return false;
  }
  last.set(channel, {source, at: now});
  return true;
}

/** Test hook: forget the last claims. */
export function resetTransportGate(): void {
  last.clear();
}
