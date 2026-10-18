import {storage} from './storage';
import fallback from '../../data/reciters-fallback.json';

// tvDataService captures EXPO_PUBLIC_BAYAAN_API_URL at module load, so the
// backend-enabled branches only run when it is set. Set it before the module
// is loaded (via the dynamic import in beforeAll below), then exercise the
// live-fetch and killswitch paths.
process.env.EXPO_PUBLIC_BAYAAN_API_URL = 'https://api.test';
process.env.EXPO_PUBLIC_KILLSWITCH_URL = 'https://config.test/app-config.json';

let service: typeof import('./tvDataService');

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function reciter(id: string) {
  return {id, name: `Reciter ${id}`, image_url: null, rewayat: []};
}

/** One page of the API's `{data, meta}` envelope. */
function page(data: unknown[], totalPages: number) {
  return {
    ok: true,
    json: async () => ({data, meta: {total_pages: totalPages}}),
  };
}

beforeAll(async () => {
  service = await import('./tvDataService');
});

beforeEach(() => {
  storage.clearAll();
  mockFetch.mockReset();
});

describe('tvDataService', () => {
  it('returns cached reciters synchronously when cache is warm', () => {
    storage.set(
      'bayaan_reciters',
      JSON.stringify({version: '4', data: fallback.slice(0, 2)}),
    );
    const cached = service.getCachedReciters();
    expect(cached).toHaveLength(2);
  });

  it('returns null from getCachedReciters when cache version mismatches', () => {
    storage.set(
      'bayaan_reciters',
      JSON.stringify({version: '1', data: fallback}),
    );
    expect(service.getCachedReciters()).toBeNull();
  });

  it('fetches live and writes cache', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({useBackendApi: true}),
    });
    mockFetch.mockResolvedValueOnce(page([reciter('1')], 1));
    const result = await service.fetchReciters();
    expect(result).toHaveLength(1);
    expect(service.getCachedReciters()).toHaveLength(1);
    expect(mockFetch.mock.calls[1][0]).toBe(
      'https://api.test/v1/reciters?page=1&limit=200',
    );
  });

  it('reads every page of the catalog', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({useBackendApi: true}),
    });
    mockFetch.mockResolvedValueOnce(page([reciter('1'), reciter('2')], 2));
    mockFetch.mockResolvedValueOnce(page([reciter('3')], 2));
    const result = await service.fetchReciters();
    expect(result.map(r => r.id)).toEqual(['1', '2', '3']);
    expect(mockFetch.mock.calls[2][0]).toBe(
      'https://api.test/v1/reciters?page=2&limit=200',
    );
  });

  it('never stores an empty or unexpected response as the catalog', async () => {
    storage.set(
      'bayaan_reciters',
      JSON.stringify({version: '4', data: fallback.slice(0, 2), savedAt: 0}),
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({useBackendApi: true}),
    });
    mockFetch.mockResolvedValueOnce(page([], 1));
    expect(await service.fetchReciters()).toHaveLength(2);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({useBackendApi: true}),
    });
    // An old-style bare array is not the envelope.
    mockFetch.mockResolvedValueOnce({ok: true, json: async () => [reciter('9')]});
    expect(await service.fetchReciters()).toHaveLength(2);
    expect(service.getCachedReciters()).toHaveLength(2);
  });

  it('treats a stored empty list as no list', () => {
    storage.set(
      'bayaan_reciters',
      JSON.stringify({version: '4', data: [], savedAt: Date.now()}),
    );
    expect(service.getCachedReciters()).toBeNull();
  });

  it('shares one fetch between callers that ask at the same time', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({useBackendApi: true}),
    });
    mockFetch.mockResolvedValueOnce(page([reciter('1')], 1));
    const [a, b] = await Promise.all([
      service.fetchReciters(),
      service.seedDefaultReciter().then(() => service.fetchReciters()),
    ]);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('reads rewayat from the catalog without a network call', async () => {
    const withRewayat = fallback.find(r => (r.rewayat ?? []).length > 0)!;
    storage.set(
      'bayaan_reciters',
      JSON.stringify({version: '4', data: [withRewayat]}),
    );
    const rewayat = await service.fetchRewayat(String(withRewayat.id));
    expect(rewayat.length).toBeGreaterThan(0);
    expect(await service.fetchRewayat('no-such-reciter')).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('reads rewayat from the current catalog, not an old per-reciter copy', async () => {
    const withRewayat = fallback.find(r => (r.rewayat ?? []).length > 0)!;
    const id = String(withRewayat.id);
    storage.set(
      'bayaan_reciters',
      JSON.stringify({version: '4', data: [withRewayat]}),
    );
    storage.set(
      `bayaan_reciter_servers_${id}`,
      JSON.stringify({version: '4', data: [{id: 'old', server: 'https://old'}]}),
    );
    const rewayat = await service.fetchRewayat(id);
    expect(rewayat.map(r => r.id)).not.toContain('old');
    expect(service.getCachedRewayat(id)?.map(r => r.id)).not.toContain('old');
  });

  it('falls back to bundled JSON when fetch fails and cache empty', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    const result = await service.fetchReciters();
    expect(result.length).toBeGreaterThan(0);
  });

  it('tries the network again on the next fetch after falling back', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    await service.fetchReciters();
    const calls = mockFetch.mock.calls.length;
    await service.fetchReciters();
    expect(mockFetch.mock.calls.length).toBeGreaterThan(calls);
  });

  it('respects killswitch (useBackendApi=false)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({useBackendApi: false}),
    });
    const result = await service.fetchReciters();
    expect(result.length).toBeGreaterThan(0);
    expect(mockFetch).toHaveBeenCalledTimes(1); // only killswitch call
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://config.test/app-config.json',
    );
  });

  it('skips the killswitch when no config URL is set', async () => {
    const saved = process.env.EXPO_PUBLIC_KILLSWITCH_URL;
    delete process.env.EXPO_PUBLIC_KILLSWITCH_URL;
    let isolated!: typeof import('./tvDataService');
    jest.isolateModules(() => {
      isolated = require('./tvDataService');
    });
    process.env.EXPO_PUBLIC_KILLSWITCH_URL = saved;
    mockFetch.mockResolvedValueOnce(page([reciter('1')], 1));
    const result = await isolated.fetchReciters();
    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://api.test/v1/reciters?page=1&limit=200',
    );
  });

  it('parses the stored list once and re-reads it when it changes', () => {
    const parse = jest.spyOn(JSON, 'parse');
    storage.set(
      'bayaan_reciters',
      JSON.stringify({version: '4', data: fallback.slice(0, 2)}),
    );
    const first = service.getCachedReciters();
    expect(service.getCachedReciters()).toBe(first);
    expect(service.getCachedReciter(String(fallback[1].id))?.id).toBe(
      String(fallback[1].id),
    );
    expect(parse).toHaveBeenCalledTimes(1);

    storage.set(
      'bayaan_reciters',
      JSON.stringify({version: '4', data: fallback.slice(0, 3)}),
    );
    expect(service.getCachedReciters()).toHaveLength(3);
    expect(parse).toHaveBeenCalledTimes(2);
    parse.mockRestore();
  });

  it('serves a fresh cache without the network', async () => {
    storage.set(
      'bayaan_reciters',
      JSON.stringify({
        version: '4',
        data: fallback.slice(0, 2),
        savedAt: Date.now(),
      }),
    );
    const result = await service.fetchReciters();
    expect(result).toHaveLength(2);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refreshes a stale cache, and keeps it when the refresh fails', async () => {
    const stale = Date.now() - service.RECITERS_TTL_MS - 1;
    storage.set(
      'bayaan_reciters',
      JSON.stringify({
        version: '4',
        data: fallback.slice(0, 2),
        savedAt: stale,
      }),
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({useBackendApi: true}),
    });
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    const result = await service.fetchReciters();
    expect(result).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('judges freshness by the save time', () => {
    const now = 1_000_000_000;
    expect(service.isReciterCacheFresh(undefined, now)).toBe(false);
    expect(service.isReciterCacheFresh(now - 1000, now)).toBe(true);
    expect(
      service.isReciterCacheFresh(now - service.RECITERS_TTL_MS, now),
    ).toBe(false);
  });

  it('buildAudioUrl pads surah number to 3 digits', () => {
    expect(service.buildAudioUrl('https://cdn.example.com/reciter', 7)).toBe(
      'https://cdn.example.com/reciter/007.mp3',
    );
    expect(service.buildAudioUrl('https://cdn.example.com/reciter/', 114)).toBe(
      'https://cdn.example.com/reciter/114.mp3',
    );
  });
});
