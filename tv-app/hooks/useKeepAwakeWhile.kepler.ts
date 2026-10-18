/**
 * Vega: expo-keep-awake has no Vega port, and neither the Vega SDK packages
 * tv-vega uses (react-native-kepler, kepler-media-controls, w3cmedia) nor
 * the Vega developer docs offer a wake-lock or screensaver API (checked
 * October 2026). So this is a no-op there for now. Whether an active media
 * session already holds the screen awake is on tv-vega/DEVICE-CHECKLIST.md.
 * The shared screens call it the same way on every platform.
 */
export function useKeepAwakeWhile(_active: boolean, _tag: string): void {}
