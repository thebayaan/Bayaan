import {fetchReciters, getCachedReciters, buildAudioUrl} from './tvDataService';
import {storage} from './storage';
import fallback from '../../data/reciters-fallback.json';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

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
    const cached = getCachedReciters();
    expect(cached).toHaveLength(2);
  });

  it('returns null from getCachedReciters when cache version mismatches', () => {
    storage.set(
      'bayaan_reciters',
      JSON.stringify({version: '1', data: fallback}),
    );
    expect(getCachedReciters()).toBeNull();
  });

  it('fetches live and writes cache', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({useBackendApi: true}),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{id: '1', name: 'Test', image_url: null}],
    });
    const result = await fetchReciters();
    expect(result).toHaveLength(1);
    expect(getCachedReciters()).toHaveLength(1);
  });

  it('falls back to bundled JSON when fetch fails and cache empty', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    const result = await fetchReciters();
    expect(result.length).toBeGreaterThan(0);
  });

  it('respects killswitch (useBackendApi=false)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({useBackendApi: false}),
    });
    const result = await fetchReciters();
    expect(result.length).toBeGreaterThan(0);
    expect(mockFetch).toHaveBeenCalledTimes(1); // only killswitch call
  });

  it('buildAudioUrl pads surah number to 3 digits', () => {
    expect(buildAudioUrl('https://cdn.example.com/reciter', 7)).toBe(
      'https://cdn.example.com/reciter/007.mp3',
    );
    expect(buildAudioUrl('https://cdn.example.com/reciter/', 114)).toBe(
      'https://cdn.example.com/reciter/114.mp3',
    );
  });
});
