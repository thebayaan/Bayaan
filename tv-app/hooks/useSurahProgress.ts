import {useRef} from 'react';
import {surahProgress} from '../services/surahsPlayback';
import {useContinueListening} from './useContinueListening';

/**
 * Listening progress per surah for a grid's bars. The player saves progress
 * every 5 s; the map keeps its identity until a bar would visibly move, so
 * a grid's renderItem (and every cell) doesn't re-render on each save.
 */
export function useSurahProgress(
  reciterId?: string,
): ReadonlyMap<number, number> {
  const entries = useContinueListening();
  const next = surahProgress(entries, reciterId);
  const held = useRef(next);
  if (held.current.key !== next.key) held.current = next;
  return held.current.bySurah;
}
