// @ai-generated
/**
 * useQuranSearch / useQuranRootSearch with the data service mocked: queries
 * that are not for the Quran text never reach it, a slow older response is
 * dropped, and errors surface as states.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {
  useQuranRootSearch,
  useQuranSearch,
  type QuranRootSearchState,
  type QuranSearchState,
} from '@/hooks/useQuranSearch';
import type {QuranSearchOutcome} from '@/services/search/QuranSearchDataService';

interface Pending {
  query: string;
  resolve: (outcome: QuranSearchOutcome) => void;
  reject: (error: Error) => void;
}

const mockPending: Pending[] = [];
const mockRoots = new Map<string, {id: number; root: string}>();

jest.mock('@/services/search/QuranSearchDataService', () => ({
  quranSearchDataService: {
    search: jest.fn(
      (query: string) =>
        new Promise((resolve, reject) => {
          mockPending.push({query, resolve, reject});
        }),
    ),
    initialize: jest.fn(async () => undefined),
    findRoot: jest.fn((root: string) => mockRoots.get(root) ?? null),
    rootSearch: jest.fn(async (id: number) => ({
      root: {id, root: 'ر ح م', words: 339, ayahs: 313},
      lemmas: [],
      hits: () => [],
    })),
  },
}));

const service = (
  jest.requireMock('@/services/search/QuranSearchDataService') as {
    quranSearchDataService: {
      search: jest.Mock;
      rootSearch: jest.Mock;
    };
  }
).quranSearchDataService;

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT =
  true;

function textOutcome(ayahCount: number): QuranSearchOutcome {
  return {
    kind: 'text',
    result: {kind: 'phrase', hits: [], ayahCount, occurrenceCount: ayahCount},
    rootSuggestions: [],
  };
}

function renderSearch(initial: string, enabled = true) {
  const states: QuranSearchState[] = [];
  let setQuery: (query: string) => void = () => undefined;
  function Probe(): null {
    const [query, set] = React.useState(initial);
    setQuery = set;
    states.push(useQuranSearch(query, {enabled}));
    return null;
  }
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<Probe />);
  });
  return {
    latest: () => states[states.length - 1],
    type: (query: string) => act(() => setQuery(query)),
    unmount: () => act(() => renderer?.unmount()),
  };
}

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  mockPending.length = 0;
  mockRoots.clear();
  service.search.mockClear();
  service.rootSearch.mockClear();
  // react-test-renderer prints a deprecation notice under React 19.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

describe('useQuranSearch', () => {
  it.each([['husary'], ['2:255'], ['صفحة 5'], [''], ['   ']])(
    'stays idle for %j without asking the service',
    query => {
      const view = renderSearch(query);
      expect(view.latest()).toEqual({status: 'idle'});
      expect(service.search).not.toHaveBeenCalled();
      view.unmount();
    },
  );

  it('stays idle while disabled', () => {
    const view = renderSearch('الرحمن', false);
    expect(view.latest()).toEqual({status: 'idle'});
    expect(service.search).not.toHaveBeenCalled();
    view.unmount();
  });

  it('searches, then shows the outcome', async () => {
    const view = renderSearch('الرحمن');
    expect(view.latest()).toEqual({status: 'searching', previous: null});
    expect(service.search).toHaveBeenCalledWith('الرحمن');
    await act(async () => mockPending[0].resolve(textOutcome(56)));
    expect(view.latest()).toEqual({status: 'done', outcome: textOutcome(56)});
    view.unmount();
  });

  it('drops an older response that arrives after a newer one', async () => {
    const view = renderSearch('الرحمن');
    view.type('الرحيم');
    expect(mockPending.map(p => p.query)).toEqual(['الرحمن', 'الرحيم']);
    await act(async () => mockPending[1].resolve(textOutcome(2)));
    expect(view.latest()).toEqual({status: 'done', outcome: textOutcome(2)});
    await act(async () => mockPending[0].resolve(textOutcome(56)));
    expect(view.latest()).toEqual({status: 'done', outcome: textOutcome(2)});
    view.unmount();
  });

  it('keeps the last outcome while the next query runs', async () => {
    const view = renderSearch('الرحمن');
    await act(async () => mockPending[0].resolve(textOutcome(56)));
    view.type('الرحمن الرحيم');
    expect(view.latest()).toEqual({
      status: 'searching',
      previous: textOutcome(56),
    });
    view.unmount();
  });

  it('reports a failed search as an error', async () => {
    const view = renderSearch('الرحمن');
    await act(async () => mockPending[0].reject(new Error('disk full')));
    expect(view.latest()).toEqual({status: 'error'});
    view.unmount();
  });

  it('goes idle again for a query that is not for the Quran text', async () => {
    const view = renderSearch('الرحمن');
    await act(async () => mockPending[0].resolve(textOutcome(56)));
    view.type('2:255');
    expect(view.latest()).toEqual({status: 'idle'});
    view.type('الرحيم');
    expect(view.latest()).toEqual({status: 'searching', previous: null});
    view.unmount();
  });
});

describe('useQuranRootSearch', () => {
  function renderRoot(root: string | null) {
    const states: QuranRootSearchState[] = [];
    function Probe(): null {
      states.push(useQuranRootSearch(root));
      return null;
    }
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(<Probe />);
    });
    return {
      latest: () => states[states.length - 1],
      unmount: () => act(() => renderer?.unmount()),
    };
  }

  it('loads a known root', async () => {
    mockRoots.set('ر ح م', {id: 7, root: 'ر ح م'});
    const view = renderRoot('ر ح م');
    expect(view.latest()).toEqual({status: 'loading', result: null});
    await act(async () => undefined);
    expect(view.latest().status).toBe('done');
    expect(view.latest().result?.root.words).toBe(339);
    expect(service.rootSearch).toHaveBeenCalledWith(7);
    view.unmount();
  });

  it('says a root is missing when the index has none', async () => {
    const view = renderRoot('ظ ظ ظ');
    await act(async () => undefined);
    expect(view.latest()).toEqual({status: 'missing', result: null});
    expect(renderRoot(null).latest()).toEqual({
      status: 'missing',
      result: null,
    });
    view.unmount();
  });

  it('reports a failure as an error', async () => {
    mockRoots.set('ر ح م', {id: 7, root: 'ر ح م'});
    service.rootSearch.mockRejectedValueOnce(new Error('broken'));
    const view = renderRoot('ر ح م');
    await act(async () => undefined);
    expect(view.latest()).toEqual({status: 'error', result: null});
    view.unmount();
  });
});
