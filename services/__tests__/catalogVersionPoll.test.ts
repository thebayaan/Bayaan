// RFC-010 — catalogVersionPoll behavior.
//
// Covers the three behaviors that matter for fork adopters:
//   - undefined endpoint → no-op (Bayaan default)
//   - parse failure / network failure → fail-open (no refetch, no throw)
//   - version > lastSeen → refetch called with version + optional url

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

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({remove: jest.fn()})),
  },
}));

jest.mock('../../config/branding', () => {
  const branding: {catalogVersionEndpoint?: string} = {};
  return {
    __esModule: true,
    default: branding,
    __mockBranding: branding,
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import branding from '../../config/branding';
import {
  initCatalogVersionPolling,
  teardownCatalogVersionPolling,
} from '../catalogVersionPoll';

const mockStore = (
  AsyncStorage as unknown as {__mockStore: Map<string, string>}
).__mockStore;
const mockBranding = branding as unknown as {catalogVersionEndpoint?: string};

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  mockStore.clear();
  mockBranding.catalogVersionEndpoint = undefined;
  teardownCatalogVersionPolling();
  (global as unknown as {fetch: jest.Mock}).fetch = jest.fn();
});

describe('initCatalogVersionPolling', () => {
  it('is a no-op when branding.catalogVersionEndpoint is undefined', async () => {
    const refetch = jest.fn();
    initCatalogVersionPolling(refetch);
    await flush();
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(0);
    expect(refetch).not.toHaveBeenCalled();
  });

  it('fails open on a 500 — no refetch, no throw', async () => {
    mockBranding.catalogVersionEndpoint = 'https://example.test/version.json';
    (global.fetch as jest.Mock).mockResolvedValueOnce({ok: false, status: 500});
    const refetch = jest.fn();
    initCatalogVersionPolling(refetch);
    await flush();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('fails open on a parse error', async () => {
    mockBranding.catalogVersionEndpoint = 'https://example.test/version.json';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error('invalid JSON')),
    });
    const refetch = jest.fn();
    initCatalogVersionPolling(refetch);
    await flush();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('refetches when server version exceeds lastSeen, with versioned url', async () => {
    mockBranding.catalogVersionEndpoint = 'https://example.test/version.json';
    mockStore.set('bayaan:lastSeenCatalogVersion', '7');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          version: 8,
          url: 'https://example.test/catalog/v8.json',
        }),
    });
    const refetch = jest.fn().mockResolvedValue(undefined);
    initCatalogVersionPolling(refetch);
    await flush();
    await flush();
    expect(refetch).toHaveBeenCalledWith(8, 'https://example.test/catalog/v8.json');
    expect(mockStore.get('bayaan:lastSeenCatalogVersion')).toBe('8');
  });

  it('does not refetch when server version equals lastSeen', async () => {
    mockBranding.catalogVersionEndpoint = 'https://example.test/version.json';
    mockStore.set('bayaan:lastSeenCatalogVersion', '8');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({version: 8}),
    });
    const refetch = jest.fn();
    initCatalogVersionPolling(refetch);
    await flush();
    await flush();
    expect(refetch).not.toHaveBeenCalled();
  });
});
