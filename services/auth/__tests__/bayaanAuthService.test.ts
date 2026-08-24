const mockOpenBrowserAsync = jest.fn();
const mockDismissBrowser = jest.fn();
const mockSecureStore = new Map<string, string>();

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: (...args: unknown[]) => mockOpenBrowserAsync(...args),
  dismissBrowser: () => mockDismissBrowser(),
}));

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

import {BayaanAuthError, createBayaanAuthService} from '../bayaanAuthService';
import {
  getBayaanSession,
  getPendingBayaanAuthState,
  saveBayaanSession,
  savePendingBayaanAuthState,
} from '../bayaanSessionStorage';

const apiUrl = 'https://api-prelive.thebayaan.com';
const profile = {
  accountId: 'bayaan-account-id',
  email: 'reader@example.test',
  name: 'Reader',
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

beforeEach(() => {
  mockOpenBrowserAsync.mockReset();
  mockDismissBrowser.mockReset();
  mockSecureStore.clear();
  global.fetch = jest.fn();
});

describe('Bayaan BFF auth service', () => {
  it('starts sign-in through the BFF and remembers only state before opening the browser', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        authorizationUrl:
          'https://api-prelive.thebayaan.com/v1/qf/auth/launch?state=state-123',
        state: 'state-123',
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      }),
    );

    const service = createBayaanAuthService({apiUrl});

    await service.signIn();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api-prelive.thebayaan.com/v1/qf/auth/start',
      expect.objectContaining({method: 'POST'}),
    );
    await expect(getPendingBayaanAuthState()).resolves.toEqual({
      state: 'state-123',
      expiresAt: expect.any(Number),
    });
    expect(mockOpenBrowserAsync).toHaveBeenCalledWith(
      'https://api-prelive.thebayaan.com/v1/qf/auth/launch?state=state-123',
    );
  });

  it.each(['cancel', 'dismiss'])(
    'clears pending state when the browser returns %s',
    async browserResult => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        jsonResponse({
          authorizationUrl:
            'https://api-prelive.thebayaan.com/v1/qf/auth/launch?state=state-123',
          state: 'state-123',
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        }),
      );
      mockOpenBrowserAsync.mockResolvedValueOnce({type: browserResult});

      const service = createBayaanAuthService({apiUrl});

      await expect(service.signIn()).rejects.toMatchObject({
        code: 'access_denied',
        message: 'Sign-in was cancelled',
      });
      await expect(getPendingBayaanAuthState()).resolves.toBeNull();
    },
  );

  it('completes a valid app callback once and persists only the opaque session', async () => {
    await savePendingBayaanAuthState({
      state: 'state-123',
      expiresAt: Date.now() + 300_000,
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        sessionToken: 'opaque-bayaan-session',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        profile,
      }),
    );

    const service = createBayaanAuthService({apiUrl});
    const result = await service.handleCallbackUrl(
      'bayaan://oauth/callback?handoff=handoff-123&state=state-123',
    );

    expect(result).toEqual({
      token: 'opaque-bayaan-session',
      expiresAt: expect.any(Number),
      profile,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api-prelive.thebayaan.com/v1/qf/auth/complete',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({handoff: 'handoff-123', state: 'state-123'}),
      }),
    );
    await expect(getBayaanSession()).resolves.toMatchObject({
      token: 'opaque-bayaan-session',
      profile,
    });
    await expect(getPendingBayaanAuthState()).resolves.toBeNull();
    expect(JSON.stringify([...mockSecureStore.values()])).not.toContain(
      'handoff-123',
    );
  });

  it('rejects duplicate cold-start callback delivery after pending state is consumed', async () => {
    await savePendingBayaanAuthState({
      state: 'state-123',
      expiresAt: Date.now() + 300_000,
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        sessionToken: 'opaque-bayaan-session',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        profile,
      }),
    );
    const service = createBayaanAuthService({apiUrl});

    await service.handleCallbackUrl(
      'bayaan://oauth/callback?handoff=handoff-123&state=state-123',
    );
    await expect(
      service.handleCallbackUrl(
        'bayaan://oauth/callback?handoff=handoff-123&state=state-123',
      ),
    ).rejects.toMatchObject({code: 'missing_state'});
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'state mismatch',
      'bayaan://oauth/callback?handoff=handoff-123&state=other-state',
      'state_mismatch',
    ],
    [
      'missing state',
      'bayaan://oauth/callback?handoff=handoff-123',
      'malformed_callback',
    ],
    [
      'wrong route',
      'bayaan://quran/1?handoff=handoff-123&state=state-123',
      'malformed_callback',
    ],
    [
      'fragment payload',
      'bayaan://oauth/callback?handoff=handoff-123&state=state-123#access_token=leak',
      'forbidden_callback_artifact',
    ],
    [
      'token query payload',
      'bayaan://oauth/callback?handoff=handoff-123&state=state-123&access_token=leak',
      'forbidden_callback_artifact',
    ],
    [
      'authorization code query payload',
      'bayaan://oauth/callback?handoff=handoff-123&state=state-123&code=leak',
      'forbidden_callback_artifact',
    ],
  ])('rejects a malformed callback with %s', async (_name, url, code) => {
    await savePendingBayaanAuthState({
      state: 'state-123',
      expiresAt: Date.now() + 300_000,
    });

    const service = createBayaanAuthService({apiUrl});

    await expect(service.handleCallbackUrl(url)).rejects.toMatchObject({code});
    await expect(getPendingBayaanAuthState()).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('surfaces cancellation without leaking provider details', async () => {
    await savePendingBayaanAuthState({
      state: 'state-123',
      expiresAt: Date.now() + 300_000,
    });
    const service = createBayaanAuthService({apiUrl});

    await expect(
      service.handleCallbackUrl(
        'bayaan://oauth/callback?error=access_denied&state=state-123&error_description=secret',
      ),
    ).rejects.toMatchObject({
      code: 'access_denied',
      message: 'Sign-in was cancelled',
    });
    await expect(getPendingBayaanAuthState()).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('maps expired or replayed handoff responses to a stable error and clears pending state', async () => {
    await savePendingBayaanAuthState({
      state: 'state-123',
      expiresAt: Date.now() + 300_000,
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({error: {code: 'QF_HANDOFF_INVALID'}}, 401),
    );

    const service = createBayaanAuthService({apiUrl});

    await expect(
      service.handleCallbackUrl(
        'bayaan://oauth/callback?handoff=handoff-123&state=state-123',
      ),
    ).rejects.toMatchObject({code: 'handoff_invalid'});
    await expect(getPendingBayaanAuthState()).resolves.toBeNull();
    await expect(getBayaanSession()).resolves.toBeNull();
  });

  it('restores a stored session by validating it with the BFF session endpoint', async () => {
    await saveBayaanSession({
      token: 'opaque-bayaan-session',
      expiresAt: Date.now() + 3_600_000,
      profile,
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        profile: {...profile, name: 'Fresh Reader'},
      }),
    );

    const service = createBayaanAuthService({apiUrl});
    const result = await service.restore();

    expect(result?.profile.name).toBe('Fresh Reader');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api-prelive.thebayaan.com/v1/qf/auth/session',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer opaque-bayaan-session',
        }),
      }),
    );
  });

  it('clears local state when restore sees a revoked session and never blocks app init', async () => {
    await saveBayaanSession({
      token: 'revoked-session',
      expiresAt: Date.now() + 3_600_000,
      profile,
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({error: {code: 'UNAUTHORIZED'}}, 401),
    );

    const service = createBayaanAuthService({apiUrl});

    await expect(service.restore()).resolves.toBeNull();
    await expect(getBayaanSession()).resolves.toBeNull();
  });

  it('logs out through the BFF, clears local session, and suppresses raw session values', async () => {
    await saveBayaanSession({
      token: 'opaque-bayaan-session',
      expiresAt: Date.now() + 3_600_000,
      profile,
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({success: true}),
    );

    const service = createBayaanAuthService({apiUrl});
    await service.logout();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api-prelive.thebayaan.com/v1/qf/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer opaque-bayaan-session',
        }),
      }),
    );
    await expect(getBayaanSession()).resolves.toBeNull();
  });

  it('uses sanitized error messages for callback failures', () => {
    const error = new BayaanAuthError(
      'forbidden_callback_artifact',
      'Unsafe auth callback',
      {unsafeUrl: 'bayaan://oauth/callback?handoff=secret'},
    );

    expect(error.message).not.toContain('handoff=secret');
    expect(error.code).toBe('forbidden_callback_artifact');
  });
});
