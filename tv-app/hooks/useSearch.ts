import {useCallback, useEffect, useMemo, useState} from 'react';
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
  /**
   * Settles `text` at once, skipping the debounce: for a picked recent or
   * suggestion, so its rows and results arrive in the same render as the
   * query and the focused row never unmounts in between.
   */
  settleNow: (text: string) => void;
}

export type TvSearchEngine = ReturnType<typeof createTvSearch>;

/** Anything with a letter or digit in it searches; the phone has no minimum. */
export function isActiveQuery(query: string): boolean {
  return toSearchKey(query).length > 0;
}

/** Whether the typed query still waits for its results. */
export function isPending(query: string, settled: string): boolean {
  return isActiveQuery(query) && settled !== query;
}

export type SearchPane = 'browse' | 'results' | 'empty';

/**
 * What the right side shows, decided by the settled query so it never
 * blanks for the debounce: the browse tiles before typing (and while the
 * first query settles), the results once there is a top result (the last
 * ones stay up while a new query settles), and the empty state when the
 * settled query found nothing (it stays up, unblinking, while more letters
 * of a query with no matches settle).
 */
export function searchPane(
  query: string,
  settled: string,
  hasTop: boolean,
): SearchPane {
  if (!isActiveQuery(query)) return 'browse';
  if (hasTop) return 'results';
  return isActiveQuery(settled) ? 'empty' : 'browse';
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

  const settleNow = useCallback(
    (text: string) => setSettled(isActiveQuery(text) ? text : ''),
    [],
  );

  return {
    settled,
    results,
    suggestions,
    pending: isPending(query, settled),
    settleNow,
  };
}
