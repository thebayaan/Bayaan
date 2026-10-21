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

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadMomentSnippets,
  resetMomentSnippetsForTests,
  SNIPPETS_CACHE_KEY,
  SNIPPETS_MAX_AGE_MS,
} from '../snippetSource';

const mockStore = (
  AsyncStorage as unknown as {__mockStore: Map<string, string>}
).__mockStore;

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

function respond(status: number, body?: unknown, etag?: string) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: {get: (name: string) => (name === 'ETag' && etag ? etag : null)},
    json: () => Promise.resolve(body),
  });
}

function seedCache(fetchedAt: number, version = 1, etag: string | null = null) {
  mockStore.set(
    SNIPPETS_CACHE_KEY,
    JSON.stringify({
      version,
      snippets: [{...snippet, id: 'cached'}],
      etag,
      fetchedAt,
    }),
  );
}

function stored() {
  return JSON.parse(mockStore.get(SNIPPETS_CACHE_KEY)!);
}

beforeEach(() => {
  mockStore.clear();
  resetMomentSnippetsForTests();
  process.env.EXPO_PUBLIC_BAYAAN_API_URL = 'https://api.example.test/';
  process.env.EXPO_PUBLIC_BAYAAN_API_KEY = 'key';
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  fetchMock = jest.fn();
  (global as unknown as {fetch: jest.Mock}).fetch = fetchMock;
});

describe('loadMomentSnippets', () => {
  it('fetches, returns and caches the list with its version and ETag', async () => {
    respond(200, {version: 7, snippets: [snippet]}, '"sha-7"');
    const list = await loadMomentSnippets();
    expect(list.map(s => s.id)).toEqual(['sn-1']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/v1/snippets',
      expect.objectContaining({
        headers: expect.objectContaining({Authorization: 'Bearer key'}),
      }),
    );
    expect(fetchMock.mock.calls[0][1].headers['If-None-Match']).toBeUndefined();
    expect(stored()).toMatchObject({version: 7, etag: '"sha-7"'});
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

  it('uses a recently checked cache without a request', async () => {
    seedCache(Date.now());
    const list = await loadMomentSnippets();
    expect(list.map(s => s.id)).toEqual(['cached']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('revalidates an old cache with its ETag and keeps it on a 304', async () => {
    const old = Date.now() - SNIPPETS_MAX_AGE_MS - 1;
    seedCache(old, 3, '"sha-3"');
    respond(304);
    expect((await loadMomentSnippets()).map(s => s.id)).toEqual(['cached']);
    await flush();
    expect(fetchMock.mock.calls[0][1].headers['If-None-Match']).toBe('"sha-3"');
    expect(stored()).toMatchObject({version: 3, etag: '"sha-3"'});
    expect(stored().fetchedAt).toBeGreaterThan(old);
    expect(stored().snippets[0].id).toBe('cached');
  });

  it('replaces an old cache when the list changed', async () => {
    seedCache(Date.now() - SNIPPETS_MAX_AGE_MS - 1, 3, '"sha-3"');
    respond(200, {version: 4, snippets: [snippet]}, '"sha-4"');
    expect((await loadMomentSnippets()).map(s => s.id)).toEqual(['cached']);
    await flush();
    expect(stored()).toMatchObject({version: 4, etag: '"sha-4"'});
    expect((await loadMomentSnippets()).map(s => s.id)).toEqual(['sn-1']);
  });

  it('never steps back to an older version', async () => {
    seedCache(Date.now() - SNIPPETS_MAX_AGE_MS - 1, 5, '"sha-5"');
    respond(200, {version: 4, snippets: [snippet]}, '"sha-4"');
    await loadMomentSnippets();
    await flush();
    expect(stored()).toMatchObject({version: 5, etag: '"sha-5"'});
  });

  it('keeps the cache when revalidating fails', async () => {
    seedCache(Date.now() - SNIPPETS_MAX_AGE_MS - 1);
    respond(500);
    expect((await loadMomentSnippets()).map(s => s.id)).toEqual(['cached']);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(stored().snippets[0].id).toBe('cached');
  });
});
// @ai-end
