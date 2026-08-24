const mockSecureStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) =>
    Promise.resolve(mockSecureStore.get(key) ?? null),
  ),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStore.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockSecureStore.delete(key);
    return Promise.resolve();
  }),
}));

import {
  clearBayaanSession,
  clearPendingBayaanAuthState,
  getBayaanSession,
  getPendingBayaanAuthState,
  saveBayaanSession,
  savePendingBayaanAuthState,
} from '../bayaanSessionStorage';

const future = Date.now() + 60_000;

beforeEach(() => {
  mockSecureStore.clear();
  jest.clearAllMocks();
});

describe('Bayaan SecureStore session storage', () => {
  it('round-trips only the versioned opaque Bayaan session', async () => {
    await saveBayaanSession({
      token: 'opaque-bayaan-session',
      expiresAt: future,
      profile: {
        accountId: 'bayaan-account-id',
        email: 'reader@example.test',
        name: 'Reader',
        picture: 'https://images.example.test/avatar.png',
      },
    });

    await expect(getBayaanSession()).resolves.toEqual({
      token: 'opaque-bayaan-session',
      expiresAt: future,
      profile: {
        accountId: 'bayaan-account-id',
        email: 'reader@example.test',
        name: 'Reader',
        picture: 'https://images.example.test/avatar.png',
      },
    });
    expect(JSON.stringify([...mockSecureStore.values()])).not.toContain(
      'access_token',
    );
    expect(JSON.stringify([...mockSecureStore.values()])).not.toContain(
      'refresh_token',
    );
  });

  it('treats malformed stored values as signed out and clears them', async () => {
    mockSecureStore.set('bayaan:qf-session:v1', '{not-json');

    await expect(getBayaanSession()).resolves.toBeNull();
    expect(mockSecureStore.has('bayaan:qf-session:v1')).toBe(false);
  });

  it('clears expired sessions before returning to callers', async () => {
    await saveBayaanSession({
      token: 'expired-session',
      expiresAt: Date.now() - 1_000,
      profile: {accountId: 'expired-account'},
    });

    await expect(getBayaanSession()).resolves.toBeNull();
    expect(mockSecureStore.has('bayaan:qf-session:v1')).toBe(false);
  });

  it('stores and clears the pending OAuth state separately from the session', async () => {
    await savePendingBayaanAuthState({
      state: 'state-value',
      expiresAt: future,
    });

    await expect(getPendingBayaanAuthState()).resolves.toEqual({
      state: 'state-value',
      expiresAt: future,
    });

    await clearPendingBayaanAuthState();
    await expect(getPendingBayaanAuthState()).resolves.toBeNull();
  });

  it('clears the stored session on request', async () => {
    await saveBayaanSession({
      token: 'opaque-bayaan-session',
      expiresAt: future,
      profile: {accountId: 'bayaan-account-id'},
    });

    await clearBayaanSession();

    await expect(getBayaanSession()).resolves.toBeNull();
  });
});
