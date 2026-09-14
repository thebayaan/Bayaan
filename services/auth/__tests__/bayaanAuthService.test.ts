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

jest.mock('expo/fetch', () => ({
  fetch: (...args: unknown[]) =>
    (global.fetch as (...values: unknown[]) => unknown)(...args),
}));

import {BayaanAuthError, createBayaanAuthService} from '../bayaanAuthService';
import {BayaanBffClient} from '../bayaanBffClient';
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
  const text = JSON.stringify(body);
  const bytes = new TextEncoder().encode(text);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({'content-length': String(Buffer.byteLength(text))}),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    text: () => Promise.resolve(text),
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

  it('does not classify browser dismissal after a successful callback as access_denied', async () => {
    let resolveBrowser: (result: unknown) => void = () => undefined;
    mockOpenBrowserAsync.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveBrowser = resolve;
        }),
    );
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        jsonResponse({
          authorizationUrl:
            'https://api-prelive.thebayaan.com/v1/qf/auth/launch?state=state-123',
          state: 'state-123',
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sessionToken: 'opaque-bayaan-session',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          profile,
        }),
      );

    const service = createBayaanAuthService({apiUrl});
    const signInPromise = service.signIn();
    await new Promise(resolve => setTimeout(resolve, 0));

    await expect(
      service.handleCallbackUrl(
        'bayaan://oauth/callback?handoff=handoff-123&state=state-123',
      ),
    ).resolves.toMatchObject({token: 'opaque-bayaan-session'});

    resolveBrowser({type: 'dismiss'});
    await expect(signInPromise).resolves.toBeUndefined();
    expect(mockDismissBrowser).toHaveBeenCalledTimes(1);
  });

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

  it.each([
    ['access_denied', 'access_denied', 'Sign-in was cancelled'],
    ['oauth_failed', 'oauth_failed', 'Sign-in failed'],
  ])(
    'accepts the backend validated-state %s redirect contract',
    async (backendError, expectedCode, expectedMessage) => {
      await savePendingBayaanAuthState({
        state: 'state-123',
        expiresAt: Date.now() + 300_000,
      });
      const service = createBayaanAuthService({apiUrl});

      await expect(
        service.handleCallbackUrl(
          `bayaan://oauth/callback?error=${backendError}&state=state-123`,
        ),
      ).rejects.toMatchObject({
        code: expectedCode,
        message: expectedMessage,
      });
      await expect(getPendingBayaanAuthState()).resolves.toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'complete',
      () => new BayaanBffClient(apiUrl).completeAuth('handoff', 'state'),
    ],
    ['session', () => new BayaanBffClient(apiUrl).getSession('session')],
  ])(
    'rejects an invalid %s expiry instead of returning NaN',
    async (_name, request) => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        jsonResponse({
          sessionToken: 'opaque-session',
          expiresAt: 'not-a-date',
          profile,
        }),
      );

      await expect(request()).rejects.toMatchObject({
        code: expect.stringMatching(/^invalid_(complete|session)_response$/),
      });
    },
  );

  it('aborts a stalled auth request at the configured deadline', async () => {
    let observedSignal: AbortSignal | undefined;
    const fetchImpl = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          observedSignal = init?.signal ?? undefined;
          setTimeout(() => reject(new Error('late network failure')), 25);
        }),
    ) as unknown as typeof fetch;
    const client = new BayaanBffClient(apiUrl, {fetchImpl, timeoutMs: 5});

    await expect(client.startAuth()).rejects.toMatchObject({
      code: 'start_failed',
    });
    expect(observedSignal?.aborted).toBe(true);
  });

  it('rejects oversized auth JSON with a stable redacted error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({'content-length': '65537'}),
      text: jest.fn(),
    } as unknown as Response);
    const client = new BayaanBffClient(apiUrl);

    const error = await client.startAuth().catch(value => value);
    expect(error).toMatchObject({code: 'invalid_start_response'});
    expect(error.message).toBe('Bayaan auth request failed');
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

  it('keeps an unexpired stored session when offline during restore', async () => {
    const stored = {
      token: 'opaque-bayaan-session',
      expiresAt: Date.now() + 3_600_000,
      profile,
    };
    await saveBayaanSession(stored);
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new TypeError('Network request failed'),
    );

    const service = createBayaanAuthService({apiUrl});

    await expect(service.restore()).resolves.toEqual(stored);
    await expect(getBayaanSession()).resolves.toEqual(stored);
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
