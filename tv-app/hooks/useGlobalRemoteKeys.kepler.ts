/**
 * Vega: the audio engine gives its W3C media player media-control focus
 * (services/audioEngine.kepler.ts), and the system's default handler then
 * plays and pauses it from the remote on every screen. Toggling here too
 * would undo that press, so the app-wide handler is left to the system.
 */
export function useGlobalRemoteKeys(): void {}
