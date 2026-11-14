// @ai-generated
/**
 * Quran text and root search for the search surfaces (the Search tab, the
 * mushaf search) and the word view's root results. The caller debounces the
 * query; the hook runs one search per query and drops a response that
 * arrives after a newer query was asked.
 */
import {useEffect, useRef, useState} from 'react';
import {
  quranSearchDataService,
  type QuranSearchOutcome,
  type RootSearchResult,
} from '@/services/search/QuranSearchDataService';
import {parseQuranQuery} from '@/utils/search/quranText';

export type QuranSearchState =
  | {status: 'idle'}
  | {status: 'searching'; previous: QuranSearchOutcome | null}
  | {status: 'done'; outcome: QuranSearchOutcome}
  | {status: 'error'};

const IDLE: QuranSearchState = {status: 'idle'};

/** True when `query` is for the Quran text (not a page, number or name). */
export function isQuranQuery(query: string): boolean {
  return parseQuranQuery(query).kind !== 'none';
}

/** Opens the search index ahead of the first query (search mode entered). */
export function prefetchQuranSearch(): void {
  quranSearchDataService.initialize().catch(() => undefined);
}

interface Settled {
  query: string;
  state: QuranSearchState;
}

/**
 * The Quran search state for `query`: idle for queries that are not for the
 * Quran text, or while `enabled` is false (no search runs); searching (with
 * the last outcome, so a list can stay until the new one arrives); done; or
 * error.
 */
export function useQuranSearch(
  query: string,
  options: {enabled?: boolean} = {},
): QuranSearchState {
  const active = (options.enabled ?? true) && isQuranQuery(query);
  const [settled, setSettled] = useState<Settled | null>(null);
  const request = useRef(0);
  const lastOutcome = useRef<QuranSearchOutcome | null>(null);

  useEffect(() => {
    const id = ++request.current;
    if (!active) {
      // A later query starts from an empty list, not this one's results.
      lastOutcome.current = null;
      return;
    }
    quranSearchDataService.search(query).then(
      outcome => {
        if (id !== request.current) return;
        lastOutcome.current = outcome;
        setSettled({query, state: {status: 'done', outcome}});
      },
      () => {
        if (id !== request.current) return;
        setSettled({query, state: {status: 'error'}});
      },
    );
  }, [query, active]);

  if (!active) return IDLE;
  if (settled?.query === query) return settled.state;
  return {status: 'searching', previous: lastOutcome.current};
}

export type QuranRootSearchState = {
  status: 'loading' | 'done' | 'missing' | 'error';
  result: RootSearchResult | null;
};

const MISSING: QuranRootSearchState = {status: 'missing', result: null};
const LOADING: QuranRootSearchState = {status: 'loading', result: null};

/**
 * The words of one root (the i'rab spelling, 'ر ح م'), for the word view:
 * missing when the index has no such root (or `root` is null).
 */
export function useQuranRootSearch(root: string | null): QuranRootSearchState {
  const [settled, setSettled] = useState<{
    root: string;
    state: QuranRootSearchState;
  } | null>(null);
  const request = useRef(0);

  useEffect(() => {
    const id = ++request.current;
    if (!root) return;
    (async () => {
      await quranSearchDataService.initialize();
      const found = quranSearchDataService.findRoot(root);
      if (!found) return MISSING;
      const result = await quranSearchDataService.rootSearch(found.id);
      return {status: 'done', result} as QuranRootSearchState;
    })().then(
      state => {
        if (id === request.current) setSettled({root, state});
      },
      () => {
        if (id === request.current) {
          setSettled({root, state: {status: 'error', result: null}});
        }
      },
    );
  }, [root]);

  if (!root) return MISSING;
  if (settled?.root === root) return settled.state;
  return LOADING;
}
