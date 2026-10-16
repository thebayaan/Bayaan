import {useEffect, useMemo, useState} from 'react';
import {
  createTvSearch,
  EMPTY_RESULTS,
  type GroupedResults,
} from '../services/search/tvSearch';
import {
  buildSuggestions,
  type Suggestion,
} from '../services/search/suggestions';
import {toSearchKey} from '../../utils/search/normalize';
import type {Reciter} from '../types/reciter';

/** Every key press is deliberate on a remote, so wait only a beat. */
const DEBOUNCE_MS = 120;

export interface SearchState {
  /** The query the results are for (lags the typed one by the debounce). */
  settled: string;
  results: GroupedResults;
  suggestions: Suggestion[];
  /** True while a freshly typed query waits for the debounce to settle. */
  pending: boolean;
}

export type TvSearchEngine = ReturnType<typeof createTvSearch>;

/** Anything with a letter or digit in it searches; the phone has no minimum. */
export function isActiveQuery(query: string): boolean {
  return toSearchKey(query).length > 0;
}

/** Results and suggestions for one query: the hook's whole logic, pure. */
export function runSearch(
  engine: TvSearchEngine,
  query: string,
): {results: GroupedResults; suggestions: Suggestion[]} {
  if (!isActiveQuery(query)) {
    return {results: EMPTY_RESULTS, suggestions: []};
  }
  const results = engine.search(query);
  return {results, suggestions: buildSuggestions(query, results.ranked)};
}

/**
 * Debounced search over the catalog's reciters, the surahs, the adhkar lists
 * and verse references, on the phone's engine (see services/search/tvSearch).
 * Prior results stay up while a new query settles, so typing never flickers.
 */
export function useSearch(query: string, reciters: Reciter[]): SearchState {
  const engine = useMemo(() => createTvSearch(reciters), [reciters]);
  const active = isActiveQuery(query);
  const [settled, setSettled] = useState(query);

  useEffect(() => {
    if (!active) {
      setSettled('');
      return;
    }
    const handle = setTimeout(() => setSettled(query), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, active]);

  const {results, suggestions} = useMemo(
    () => runSearch(engine, settled),
    [engine, settled],
  );

  return {
    settled,
    results,
    suggestions,
    pending: active && settled !== query,
  };
}
