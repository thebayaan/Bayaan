// @ai-start
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
      setItem: jest.fn((k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve();
      }),
      __mockStore: store,
    },
  };
});

jest.mock('@/services/catalogVersionPoll', () => {
  const listeners = new Set<(mockVersion: number) => void>();
  const state = {lastSeen: null as number | null};
  return {
    getLastSeenCatalogVersion: jest.fn(() => Promise.resolve(state.lastSeen)),
    onCatalogVersionChange: jest.fn((l: (mockVersion: number) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    }),
    __state: state,
    __listeners: listeners,
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as poll from '@/services/catalogVersionPoll';
import {
  loadMomentSnippets,
  resetMomentSnippetsForTests,
  SNIPPETS_CACHE_KEY,
  SNIPPETS_MAX_AGE_MS,
} from '../snippetSource';

const mockStore = (
  AsyncStorage as unknown as {__mockStore: Map<string, string>}
).__mockStore;
const pollState = (poll as unknown as {__state: {lastSeen: number | null}})
  .__state;
const pollListeners = (
  poll as unknown as {__listeners: Set<(v: number) => void>}
).__listeners;

const snippet = {
  id: 'sn-1',
  reciterId: 'r1',
  reciterName: 'Reciter One',
  reciterSlug: 'reciter-one',
  reciterImageUrl: null,
  rewayatId: 'rw1',
  rewayatName: 'Hafs',
  surah: 112,
  ayahFrom: 1,
  ayahTo: 4,
  startMs: 2_000,
  endMs: 17_000,
  clipUrl: null,
  weight: 1,
};

const flush = () => new Promise(r => setImmediate(r));
let fetchMock: jest.Mock;

function respond(status: number, body?: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function seedCache(fetchedAt: number, catalogVersion: number | null) {
  mockStore.set(
    SNIPPETS_CACHE_KEY,
    JSON.stringify({
      version: 1,
      snippets: [{...snippet, id: 'cached'}],
      catalogVersion,
      fetchedAt,
    }),
  );
}

beforeEach(() => {
  mockStore.clear();
  pollState.lastSeen = null;
  resetMomentSnippetsForTests();
  process.env.EXPO_PUBLIC_BAYAAN_API_URL = 'https://api.example.test/';
  process.env.EXPO_PUBLIC_BAYAAN_API_KEY = 'key';
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  fetchMock = jest.fn();
  (global as unknown as {fetch: jest.Mock}).fetch = fetchMock;
});

describe('loadMomentSnippets', () => {
  it('fetches, returns and caches the list with its version', async () => {
    pollState.lastSeen = 4;
    respond(200, {version: 7, snippets: [snippet]});
    const list = await loadMomentSnippets();
    expect(list.map(s => s.id)).toEqual(['sn-1']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/v1/snippets',
      expect.objectContaining({
        headers: expect.objectContaining({Authorization: 'Bearer key'}),
      }),
    );
    const cached = JSON.parse(mockStore.get(SNIPPETS_CACHE_KEY)!);
    expect(cached).toMatchObject({version: 7, catalogVersion: 4});
  });

  it('returns nothing on a 404 (endpoint not deployed) and does not retry at once', async () => {
    respond(404, {error: 'Not found'});
    expect(await loadMomentSnippets()).toEqual([]);
    expect(await loadMomentSnippets()).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockStore.has(SNIPPETS_CACHE_KEY)).toBe(false);
  });

  it('returns nothing when the request throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await loadMomentSnippets()).toEqual([]);
  });

  it('does not call the backend when it is not configured', async () => {
    delete process.env.EXPO_PUBLIC_BAYAAN_API_KEY;
    expect(await loadMomentSnippets()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses a fresh cache without fetching', async () => {
    pollState.lastSeen = 4;
    seedCache(Date.now(), 4);
    const list = await loadMomentSnippets();
    expect(list.map(s => s.id)).toEqual(['cached']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves the cache and refreshes it when the catalog version changed', async () => {
    pollState.lastSeen = 5;
    seedCache(Date.now(), 4);
    respond(200, {version: 8, snippets: [snippet]});
    const list = await loadMomentSnippets();
    expect(list.map(s => s.id)).toEqual(['cached']);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockStore.get(SNIPPETS_CACHE_KEY)!).version).toBe(8);
    expect((await loadMomentSnippets()).map(s => s.id)).toEqual(['sn-1']);
  });

  it('refreshes a day-old cache, keeping it when the refresh fails', async () => {
    seedCache(Date.now() - SNIPPETS_MAX_AGE_MS - 1, null);
    respond(500);
    expect((await loadMomentSnippets()).map(s => s.id)).toEqual(['cached']);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockStore.get(SNIPPETS_CACHE_KEY)!).snippets[0].id).toBe(
      'cached',
    );
  });

  it('refetches when the poll reports a new catalog version', async () => {
    seedCache(Date.now(), null);
    await loadMomentSnippets();
    expect(fetchMock).not.toHaveBeenCalled();
    respond(200, {version: 9, snippets: [snippet]});
    pollListeners.forEach(l => l(9));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockStore.get(SNIPPETS_CACHE_KEY)!).version).toBe(9);
  });
});
// @ai-end
