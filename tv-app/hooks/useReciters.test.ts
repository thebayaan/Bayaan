import type {Reciter} from '../types/reciter';

const cachedList = [{id: 'cached'}] as unknown as Reciter[];
const freshList = [{id: 'fresh'}] as unknown as Reciter[];
const bundledList = [{id: 'bundled'}] as unknown as Reciter[];

const mockFetchReciters = jest.fn<Promise<Reciter[]>, []>();
const mockGetCached = jest.fn<Reciter[] | null, []>();

jest.mock('../services/tvDataService', () => ({
  fetchReciters: () => mockFetchReciters(),
  getCachedReciters: () => mockGetCached(),
  fallbackReciterList: () => bundledList,
}));

import {
  currentReciters,
  refreshReciters,
  resetRecitersForTest,
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

  it('falls back to the bundled list without a cache', () => {
    mockGetCached.mockReturnValue(null);
    expect(currentReciters()).toBe(bundledList);
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
});
