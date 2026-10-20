import type {Reciter} from '../types/reciter';

const cachedList = [{id: 'cached'}] as unknown as Reciter[];
const freshList = [{id: 'fresh'}] as unknown as Reciter[];

const mockFetchReciters = jest.fn<Promise<Reciter[]>, []>();
const mockGetCached = jest.fn<Reciter[] | null, []>();

// subscribe() is reached through useSyncExternalStore; call it directly.
jest.mock('react', () => ({
  useSyncExternalStore: (subscribe: (cb: () => void) => () => void) => {
    mockUnsubscribe = subscribe(() => {});
    return [];
  },
}));
let mockUnsubscribe: (() => void) | null = null;

let mockAppStateListener: ((state: string) => void) | null = null;
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (_: string, cb: (state: string) => void) => {
      mockAppStateListener = cb;
      return {remove: () => (mockAppStateListener = null)};
    },
  },
}));

jest.mock('../services/tvDataService', () => ({
  fetchReciters: () => mockFetchReciters(),
  getCachedReciters: () => mockGetCached(),
}));

import {
  currentReciters,
  recitersFailed,
  refreshReciters,
  resetRecitersForTest,
  useReciters,
} from './useReciters';

beforeEach(() => {
  resetRecitersForTest();
  mockFetchReciters.mockReset();
  mockGetCached.mockReset();
});

describe('shared reciter list', () => {
  it('reads the cache once and shares it', () => {
    mockGetCached.mockReturnValue(cachedList);
    expect(currentReciters()).toBe(cachedList);
    expect(currentReciters()).toBe(cachedList);
    expect(mockGetCached).toHaveBeenCalledTimes(1);
  });

  it('is empty without a cache, and failed once a load fails', async () => {
    mockGetCached.mockReturnValue(null);
    expect(currentReciters()).toEqual([]);
    expect(recitersFailed()).toBe(false);
    mockFetchReciters.mockRejectedValueOnce(new Error('offline'));
    await refreshReciters();
    expect(recitersFailed()).toBe(true);
    // Trying again clears the failure while it loads, then serves the list.
    mockFetchReciters.mockResolvedValueOnce(freshList);
    const retry = refreshReciters();
    expect(recitersFailed()).toBe(false);
    await retry;
    expect(currentReciters()).toBe(freshList);
  });

  it('fetches once however many readers ask, then serves the fresh list', async () => {
    mockGetCached.mockReturnValue(cachedList);
    mockFetchReciters.mockResolvedValue(freshList);
    currentReciters();
    await Promise.all([refreshReciters(), refreshReciters()]);
    expect(mockFetchReciters).toHaveBeenCalledTimes(1);
    expect(currentReciters()).toBe(freshList);
  });

  it('keeps the current list when the refresh fails or comes back empty', async () => {
    mockGetCached.mockReturnValue(cachedList);
    mockFetchReciters.mockRejectedValueOnce(new Error('offline'));
    currentReciters();
    await refreshReciters();
    expect(currentReciters()).toBe(cachedList);

    resetRecitersForTest();
    mockFetchReciters.mockResolvedValueOnce([]);
    currentReciters();
    await refreshReciters();
    expect(currentReciters()).toBe(cachedList);
  });

  it('asks again once a refresh has settled, so a long-lived TV refreshes when due', async () => {
    mockGetCached.mockReturnValue(cachedList);
    mockFetchReciters.mockResolvedValue(cachedList);
    await refreshReciters();
    await refreshReciters();
    expect(mockFetchReciters).toHaveBeenCalledTimes(2);
  });

  it('re-checks the list when the app comes back to the foreground', async () => {
    mockGetCached.mockReturnValue(cachedList);
    mockFetchReciters.mockResolvedValue(cachedList);
    useReciters();
    await new Promise(r => setImmediate(r));
    expect(mockFetchReciters).toHaveBeenCalledTimes(1);
    mockFetchReciters.mockResolvedValue(freshList);
    mockAppStateListener?.('background');
    mockAppStateListener?.('active');
    await new Promise(r => setImmediate(r));
    expect(mockFetchReciters).toHaveBeenCalledTimes(2);
    expect(currentReciters()).toBe(freshList);
    mockUnsubscribe?.();
  });
});
