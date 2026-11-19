// @ai-generated
import {useSegments} from 'expo-router';

/** Tab stacks that declare a `reciter/[id]` screen. */
export type ReciterTabStack =
  | '(a.home)'
  | '(b.search)'
  | '(b.surahs)'
  | '(c.collection)';

export type ReciterProfilePathname = `/(tabs)/${ReciterTabStack}/reciter/[id]`;

/** Tab stacks that also declare `reciter/browse` (Library has none). */
export type ReciterBrowseTabStack = Exclude<ReciterTabStack, '(c.collection)'>;

export type ReciterBrowsePathname =
  `/(tabs)/${ReciterBrowseTabStack}/reciter/browse`;

/**
 * The tab stack a route belongs to, from `useSegments()`. Routes outside a
 * tab with a reciter screen (Settings, root modals) fall back to Home.
 */
export function reciterTabStack(segments: readonly string[]): ReciterTabStack {
  const tab = segments[0] === '(tabs)' ? segments[1] : undefined;
  if (tab === '(b.search)' || tab === '(b.surahs)' || tab === '(c.collection)')
    return tab;
  return '(a.home)';
}

export function reciterProfilePathname(
  segments: readonly string[],
): ReciterProfilePathname {
  return `/(tabs)/${reciterTabStack(segments)}/reciter/[id]`;
}

/**
 * Reciter profile route in the tab the user is on, so opening a reciter
 * from Search or Library pushes onto that tab instead of jumping to Home.
 */
export function useReciterProfilePathname(): ReciterProfilePathname {
  return reciterProfilePathname(useSegments());
}

/** Reciter browser in the tab the user is on; Library falls back to Home. */
export function reciterBrowsePathname(
  segments: readonly string[],
): ReciterBrowsePathname {
  const stack = reciterTabStack(segments);
  return `/(tabs)/${stack === '(c.collection)' ? '(a.home)' : stack}/reciter/browse`;
}
