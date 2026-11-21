// @ai-generated
/**
 * The /mushaf params of a Quran search hit, and the reading of its `words`
 * param. A hit names its verse and its matched Digital Khatt slots, never a
 * page: the reader opens the page of the first matched slot once the Mushaf
 * data is ready (hooks/useMushafOpenTarget.ts), as it does for a saved verse.
 * No imports, so the Search tab and the verse sheet stay free of the reader.
 */

// A type alias (not an interface) so it is assignable to expo-router params.
export type QuranHitOpenParams = {
  surah: string;
  ayah: string;
  /** The first matched slot ('S:A:W'): the shown rewayah selects its verse. */
  anchor: string;
  /** The matched slots to flash, sorted and comma-separated ('3,4'). */
  words: string;
};

/**
 * The first of a hit's matched slots (1 when it has none): the slot its
 * anchor names, so also the one that names its verse in another rewayah.
 */
export function firstHitSlot(positions: readonly number[]): number {
  return positions.length > 0 ? Math.min(...positions) : 1;
}

/** The /mushaf params that open `verseKey` ('S:A') on its matched slots. */
export function quranHitOpenParams(
  verseKey: string,
  positions: readonly number[],
): QuranHitOpenParams {
  const [surah, ayah] = verseKey.split(':');
  const sorted = [...new Set(positions)].sort((a, b) => a - b);
  return {
    surah,
    ayah,
    anchor: `${verseKey}:${firstHitSlot(sorted)}`,
    words: sorted.join(','),
  };
}

/** The name of the Mushaf reader's route in the root stack (app/mushaf.tsx). */
export const READER_ROUTE_NAME = 'mushaf';

/** A navigation state, as far as quranHitOpenMethod reads it. */
export interface QuranHitNavigationState {
  routeNames?: readonly string[];
  routes?: readonly {name: string; state?: QuranHitNavigationState}[];
}

/**
 * Whether the navigator that declares the reader route, the app's root
 * stack, holds the reader. The navigation container's state does not start
 * at that stack: expo-router nests it under a root route of its own.
 */
function holdsReader(state: QuranHitNavigationState | undefined): boolean {
  if (!state?.routes) return false;
  if (state.routeNames?.includes(READER_ROUTE_NAME)) {
    return state.routes.some(route => route.name === READER_ROUTE_NAME);
  }
  return state.routes.some(route => holdsReader(route.state));
}

/**
 * How a hit reaches the reader, from the navigation container's state. When
 * the root stack already holds the reader (the verse sheet or the player is
 * over it, or a screen above it), 'dismissTo' (POP_TO) pops back to it and
 * gives it the hit's params, as a link to the open reader does: one reader
 * stays, and it turns to the hit (hooks/useReaderLinkPage.ts). A push there
 * would stack a second reader. With no reader, 'push' opens one: a POP_TO
 * there would replace the route on top (the tabs).
 */
export function quranHitOpenMethod(
  state: QuranHitNavigationState | undefined,
): 'dismissTo' | 'push' {
  return holdsReader(state) ? 'dismissTo' : 'push';
}

/** The slots of a `words` param ('3,4' → [3, 4]); invalid parts dropped. */
export function parseFlashWords(words: string | undefined): number[] {
  if (!words) return [];
  return words
    .split(',')
    .map(part => Number(part.trim()))
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 255);
}
