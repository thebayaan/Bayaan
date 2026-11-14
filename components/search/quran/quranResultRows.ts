// @ai-generated
/**
 * The rows of the Quran results ("Ayahs") section, shared by the Search tab
 * (phone list and iPad scope), the mushaf search and the word view's root
 * results. Pure: the surfaces render them with QuranResultRowView.
 */
import type {QuranSearchState} from '@/hooks/useQuranSearch';
import type {
  QuranLemma,
  QuranRoot,
  QuranSearchOutcome,
} from '@/services/search/QuranSearchDataService';
import type {QuranVerseHit} from '@/utils/search/quranSearch';

/** Ayah rows shown at first, and added by each "Show more". */
export const QURAN_PAGE_SIZE = 30;

export type QuranResultNote = 'none' | 'hafs' | 'allWords';

export type QuranResultRow =
  | {type: 'quran-loading'; key: string}
  | {type: 'quran-error'; key: string}
  | {
      type: 'quran-header';
      key: string;
      ayahCount: number;
      matchCount: number;
      note: QuranResultNote;
    }
  | {type: 'quran-root-suggestion'; key: string; root: QuranRoot}
  | {type: 'quran-root-header'; key: string; root: QuranRoot}
  | {
      type: 'quran-lemmas';
      key: string;
      root: QuranRoot;
      lemmas: readonly QuranLemma[];
      selected: number | null;
    }
  | {type: 'quran-verse'; key: string; hit: QuranVerseHit}
  | {type: 'quran-more'; key: string; remaining: number}
  | {type: 'quran-empty'; key: string; query: string; root: boolean};

export interface QuranResultView {
  /** Ayah rows to show (a multiple of QURAN_PAGE_SIZE). */
  shown: number;
  /** The lemma chip chosen in root mode (null: all forms). */
  selectedLemma: number | null;
  /** Say the results come from the Hafs text (another rewayah on screen). */
  hafsNote: boolean;
  query: string;
  /** Add an empty row when nothing is found (a surface without its own). */
  includeEmpty: boolean;
}

function verseRows(
  hits: readonly QuranVerseHit[],
  shown: number,
): QuranResultRow[] {
  const rows: QuranResultRow[] = hits.slice(0, shown).map(hit => ({
    type: 'quran-verse',
    key: `quran-verse-${hit.verseKey}`,
    hit,
  }));
  if (hits.length > shown) {
    rows.push({
      type: 'quran-more',
      key: 'quran-more',
      remaining: hits.length - shown,
    });
  }
  return rows;
}

function suggestionRows(roots: readonly QuranRoot[]): QuranResultRow[] {
  return roots.map(root => ({
    type: 'quran-root-suggestion',
    key: `quran-root-suggestion-${root.id}`,
    root,
  }));
}

function outcomeRows(
  outcome: QuranSearchOutcome,
  view: QuranResultView,
): QuranResultRow[] {
  if (outcome.kind === 'none') return [];
  if (outcome.kind === 'root') {
    const [first, ...others] = outcome.candidates;
    const result = outcome.result;
    if (!first || !result) {
      return view.includeEmpty
        ? [
            {
              type: 'quran-empty',
              key: 'quran-empty',
              query: view.query,
              root: true,
            },
          ]
        : [];
    }
    const hits = result.hits(view.selectedLemma);
    return [
      {type: 'quran-root-header', key: `quran-root-${first.id}`, root: first},
      {
        type: 'quran-lemmas',
        key: `quran-lemmas-${first.id}`,
        root: first,
        lemmas: result.lemmas,
        selected: view.selectedLemma,
      },
      ...verseRows(hits, view.shown),
      ...suggestionRows(others),
    ];
  }
  const {result, rootSuggestions} = outcome;
  if (!result.hits.length) {
    const rows = suggestionRows(rootSuggestions);
    if (view.includeEmpty) {
      rows.push({
        type: 'quran-empty',
        key: 'quran-empty',
        query: view.query,
        root: false,
      });
    }
    return rows;
  }
  let note: QuranResultNote = 'none';
  if (result.kind === 'allWords') note = 'allWords';
  else if (view.hafsNote) note = 'hafs';
  return [
    {
      type: 'quran-header',
      key: 'quran-header',
      ayahCount: result.ayahCount,
      matchCount: result.occurrenceCount,
      note,
    },
    ...suggestionRows(rootSuggestions),
    ...verseRows(result.hits, view.shown),
  ];
}

/** The rows for a search state (see QuranResultRow). */
export function quranResultRows(
  state: QuranSearchState,
  view: QuranResultView,
): QuranResultRow[] {
  switch (state.status) {
    case 'idle':
      return [];
    case 'error':
      return [{type: 'quran-error', key: 'quran-error'}];
    case 'searching':
      // Keep the last results on screen until the new ones arrive.
      return state.previous
        ? outcomeRows(state.previous, view)
        : [{type: 'quran-loading', key: 'quran-loading'}];
    case 'done':
      return outcomeRows(state.outcome, view);
  }
}

/** The outcome on screen: the result, or the last one while searching. */
export function shownOutcome(
  state: QuranSearchState,
): QuranSearchOutcome | null {
  if (state.status === 'done') return state.outcome;
  if (state.status === 'searching') return state.previous;
  return null;
}

/** The number of ayahs the state's outcome lists (for scope chips). */
export function quranAyahCount(
  state: QuranSearchState,
  selectedLemma: number | null = null,
): number {
  const outcome = shownOutcome(state);
  if (!outcome || outcome.kind === 'none') return 0;
  if (outcome.kind === 'text') return outcome.result.ayahCount;
  return outcome.result?.hits(selectedLemma).length ?? 0;
}

/** True when the state is a root search (catalogue rows are hidden). */
export function isRootOutcome(state: QuranSearchState): boolean {
  return shownOutcome(state)?.kind === 'root';
}
