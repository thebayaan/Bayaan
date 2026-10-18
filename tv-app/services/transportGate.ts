/**
 * One Play/Pause press, one toggle.
 *
 * On Vega a remote transport key can reach the app twice: as a key event
 * (useTVEventHandler) and as a media-control command from the system (the
 * handler in services/audioEngine.kepler.ts). Each path toggles playback, so
 * if both arrived the second would undo the first. Every play/pause from
 * either path claims the gate first; a claim from the other path within
 * GATE_MS of the last one is the same press and is dropped. Presses from the
 * same path always pass, so quick repeated presses still work.
 *
 * Elsewhere only key events exist and every claim passes.
 */

export type TransportSource = 'key' | 'system';

export const GATE_MS = 600;

let last: {source: TransportSource; at: number} | null = null;

export function claimTransport(
  source: TransportSource,
  now: number = Date.now(),
): boolean {
  if (last && last.source !== source && now - last.at < GATE_MS) return false;
  last = {source, at: now};
  return true;
}

/** Test hook: forget the last claim. */
export function resetTransportGate(): void {
  last = null;
}
