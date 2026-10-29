/**
 * Vega: expo-keep-awake has no Vega port and tv-vega bundles no wake-lock
 * API yet, so this is a no-op there for now. The shared screens call it the
 * same way on every platform.
 */
export function useKeepAwakeWhile(_active: boolean, _tag: string): void {}
