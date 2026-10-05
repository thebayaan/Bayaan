const mockOpenBrowserAsync = jest.fn();
const mockDismissBrowser = jest.fn();
const mockSecureStore = new Map<string, string>();

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: (...args: unknown[]) => mockOpenBrowserAsync(...args),
  dismissBrowser: () => mockDismissBrowser(),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async () => new Uint8Array(32).fill(1),
  CryptoDigestAlgorithm: {SHA256: 'SHA-256'},
  digestStringAsync: async (_algorithm: string, value: string) =>
    require('node:crypto').createHash('sha256').update(value).digest('hex'),
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

import * as SecureStore from 'expo-secure-store';
import {BayaanAuthError, createBayaanAuthService} from '../bayaanAuthService';
import {BayaanBffClient} from '../bayaanBffClient';
import {
  getBayaanSession,
  getPendingBayaanAuthState,
  saveBayaanSession,
  savePendingBayaanAuthState as saveStoredPending,
} from '../bayaanSessionStorage';

function savePendingBayaanAuthState(pending: {state: string; expiresAt: number}) {
  return saveStoredPending({...pending, deviceVerifier: '01'.repeat(32)});
}

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
  jest
    .mocked(SecureStore.getItemAsync)
    .mockImplementation(async key => mockSecureStore.get(key) ?? null);
  jest
    .mocked(SecureStore.setItemAsync)
    .mockImplementation(async (key, value) => {
      mockSecureStore.set(key, value);
    });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => {
    mockSecureStore.delete(key);
  });
  global.fetch = jest.fn();
});

describe('Bayaan BFF auth service', () => {
  it('sends only a SHA-256 challenge and stores the verifier only on this device', async () => {
    mockOpenBrowserAsync.mockImplementationOnce(async () => {
      await expect(getPendingBayaanAuthState()).resolves.toEqual({
        state: 'state-123', deviceVerifier: '01'.repeat(32), expiresAt: expect.any(Number),
      });
      return {type: 'cancel'};
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        authorizationUrl:
          'https://api-prelive.thebayaan.com/v1/qf/auth/launch?state=state-123',
        state: 'state-123',
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      }),
    );

    const service = createBayaanAuthService({apiUrl});

    await expect(service.signIn()).rejects.toMatchObject({code: 'access_denied'});

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api-prelive.thebayaan.com/v1/qf/auth/start',
      expect.objectContaining({method: 'POST'}),
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({deviceChallenge: require('node:crypto').createHash('sha256').update('01'.repeat(32)).digest('hex')});
    expect(JSON.stringify(body)).not.toContain('01'.repeat(32));
    expect(mockOpenBrowserAsync).toHaveBeenCalledWith(
      'https://api-prelive.thebayaan.com/v1/qf/auth/launch?state=state-123',
      'bayaan://oauth/callback',
    );
  });

  it('completes a returned redirect and joins simultaneous deep-link delivery', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({
        authorizationUrl: `${apiUrl}/v1/qf/auth/launch?state=state-123`,
        state: 'state-123', expiresAt: new Date(Date.now() + 300_000).toISOString(),
      }))
      .mockResolvedValueOnce(jsonResponse({
        sessionToken: 'opaque-bayaan-session',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(), profile,
      }));
    const url = 'bayaan://oauth/callback?handoff=handoff-123&state=state-123';
    const service = createBayaanAuthService({apiUrl});
    mockOpenBrowserAsync.mockImplementationOnce(async () => {
      const delivered = service.handleCallbackUrl(url);
      const duplicate = service.handleCallbackUrl(url);
      await expect(Promise.all([delivered, duplicate])).resolves.toHaveLength(2);
      return {type: 'success', url};
    });
    await expect(service.signIn()).resolves.toMatchObject({token: 'opaque-bayaan-session'});
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('handles a successful browser redirect without relying on router delivery', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({
        authorizationUrl: `${apiUrl}/v1/qf/auth/launch?state=state-123`,
        state: 'state-123', expiresAt: new Date(Date.now() + 300_000).toISOString(),
      }))
      .mockResolvedValueOnce(jsonResponse({
        sessionToken: 'opaque-bayaan-session',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(), profile,
      }));
    mockOpenBrowserAsync.mockResolvedValueOnce({type: 'success', url: 'bayaan://oauth/callback?handoff=handoff-123&state=state-123'});
    await expect(createBayaanAuthService({apiUrl}).signIn()).resolves.toMatchObject({profile});
    await expect(getPendingBayaanAuthState()).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('joins Android cancel while the deep-link exchange is still in flight', async () => {
    let releaseExchange: ((response: Response) => void) | undefined;
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({
        authorizationUrl: `${apiUrl}/v1/qf/auth/launch?state=state-123`,
        state: 'state-123', expiresAt: new Date(Date.now() + 300_000).toISOString(),
      }))
      .mockImplementationOnce(() => new Promise<Response>(resolve => {releaseExchange = resolve;}));
    const service = createBayaanAuthService({apiUrl});
    let delivered: Promise<unknown> | undefined;
    mockOpenBrowserAsync.mockImplementationOnce(async () => {
      delivered = service.handleCallbackUrl('bayaan://oauth/callback?handoff=handoff-123&state=state-123');
      return {type: 'cancel'};
    });
    const signingIn = service.signIn();
    for (let i = 0; i < 100 && !releaseExchange; i++) await Promise.resolve();
    expect(releaseExchange).toBeDefined();
    releaseExchange?.(jsonResponse({sessionToken: 'opaque-bayaan-session', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), profile}));
    await expect(signingIn).resolves.toMatchObject({profile});
    await expect(delivered).resolves.toMatchObject({profile});
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('clears the verifier on browser failure and restarts with a new attempt', async () => {
    (global.fetch as jest.Mock).mockImplementation(async () => jsonResponse({
      authorizationUrl: `${apiUrl}/v1/qf/auth/launch?state=state-123`,
      state: 'state-123', expiresAt: new Date(Date.now() + 300_000).toISOString(),
    }));
    mockOpenBrowserAsync.mockRejectedValueOnce(new Error('browser failed'));
    const service = createBayaanAuthService({apiUrl});
    await expect(service.signIn()).rejects.toMatchObject({code: 'network_error'});
    await expect(getPendingBayaanAuthState()).resolves.toBeNull();
    mockOpenBrowserAsync.mockResolvedValueOnce({type: 'cancel'});
    await expect(service.signIn()).rejects.toMatchObject({code: 'access_denied'});
  });

  it.each(['cancel', 'error'])(
    'revokes browser %s before failed pending deletion and rejects delayed redemption',
    async browserResult => {
      const start = (state: string) =>
        jsonResponse({
          authorizationUrl: `${apiUrl}/v1/qf/auth/launch?state=${state}`,
          state,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        });
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        start('cancelled-state'),
      );
      if (browserResult === 'cancel') {
        mockOpenBrowserAsync.mockResolvedValueOnce({type: 'cancel'});
      } else {
        mockOpenBrowserAsync.mockRejectedValueOnce(new Error('browser failed'));
      }
      const storageError = new Error('pending delete failed');
      let releaseDelete!: () => void;
      const deleteReached = new Promise<void>(reached => {
        jest
          .mocked(SecureStore.deleteItemAsync)
          .mockImplementationOnce(async key => {
            expect(key).toBe('bayaan_qf_pending_state_v1');
            await new Promise<void>(resolve => {
              releaseDelete = resolve;
              reached();
            });
            throw storageError;
          });
      });
      const service = createBayaanAuthService({apiUrl});
      const signingIn = service.signIn().catch(error => error);
      await deleteReached;
      const url =
        'bayaan://oauth/callback?handoff=cancelled-handoff&state=cancelled-state';
      const queuedCallback = service
        .handleCallbackUrl(url)
        .catch(error => error);
      releaseDelete();
      expect(await signingIn).toBe(storageError);
      expect(await queuedCallback).toMatchObject({code: 'access_denied'});

      // Storage has recovered, without logout or a new service/process.
      await expect(getPendingBayaanAuthState()).resolves.toMatchObject({
        state: 'cancelled-state',
      });
      await expect(service.handleCallbackUrl(url)).rejects.toMatchObject({
        code: 'access_denied',
      });
      await expect(getBayaanSession()).resolves.toBeNull();
      await expect(service.restore()).resolves.toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(1); // No /complete or /session.

      // Another local attempt fails before replacing the old stored proof.
      // Its pendingAttempt record must not make the revoked proof "unknown".
      (global.fetch as jest.Mock).mockResolvedValueOnce(start('failed-state'));
      jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(storageError);
      jest
        .mocked(SecureStore.deleteItemAsync)
        .mockRejectedValueOnce(storageError);
      await expect(service.signIn()).rejects.toBe(storageError);
      await expect(service.handleCallbackUrl(url)).rejects.toMatchObject({
        code: 'access_denied',
      });
      expect(global.fetch).toHaveBeenCalledTimes(2); // Still only /start calls.

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(start('fresh-state'))
        .mockResolvedValueOnce(
          jsonResponse({
            sessionToken: 'fresh-session',
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            profile,
          }),
        );
      mockOpenBrowserAsync.mockResolvedValueOnce({
        type: 'success',
        url: 'bayaan://oauth/callback?handoff=fresh-handoff&state=fresh-state',
      });
      await expect(service.signIn()).resolves.toMatchObject({
        token: 'fresh-session',
      });
      await expect(getBayaanSession()).resolves.toMatchObject({
        token: 'fresh-session',
      });
      await expect(getPendingBayaanAuthState()).resolves.toBeNull();

      // Unknown persisted proof on a legitimate cold start is not a local tombstone.
      await savePendingBayaanAuthState({
        state: 'cold-state',
        expiresAt: Date.now() + 300_000,
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        jsonResponse({
          sessionToken: 'cold-session',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          profile,
        }),
      );
      await expect(
        createBayaanAuthService({apiUrl}).handleCallbackUrl(
          'bayaan://oauth/callback?handoff=cold-handoff&state=cold-state',
        ),
      ).resolves.toMatchObject({token: 'cold-session'});
      expect(global.fetch).toHaveBeenCalledTimes(5);
    },
  );

  it('fails closed for pre-upgrade pending state with no verifier', async () => {
    mockSecureStore.set('bayaan_qf_pending_state_v1', JSON.stringify({
      version: 1, pending: {state: 'state-123', expiresAt: Date.now() + 300_000},
    }));
    const service = createBayaanAuthService({apiUrl});
    await expect(service.handleCallbackUrl('bayaan://oauth/callback?handoff=handoff-123&state=state-123'))
      .rejects.toMatchObject({code: 'missing_state'});
    expect(global.fetch).not.toHaveBeenCalled();
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
    await expect(signInPromise).resolves.toMatchObject({token: 'opaque-bayaan-session'});
    expect(mockDismissBrowser).not.toHaveBeenCalled();
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
        body: JSON.stringify({handoff: 'handoff-123', state: 'state-123', deviceVerifier: '01'.repeat(32)}),
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

  it('joins duplicate callback delivery after pending state is consumed', async () => {
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
    ).resolves.toMatchObject({token: 'opaque-bayaan-session'});
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
    // An unrelated or forged link must not cancel the real attempt.
    await expect(getPendingBayaanAuthState()).resolves.toMatchObject({
      state: 'state-123',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('still completes the real sign-in after a forged callback arrives first', async () => {
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

    await expect(
      service.handleCallbackUrl(
        'bayaan://oauth/callback?handoff=forged&state=attacker-state',
      ),
    ).rejects.toMatchObject({code: 'state_mismatch'});
    await expect(
      service.handleCallbackUrl(
        'bayaan://oauth/callback?handoff=handoff-123&state=state-123',
      ),
    ).resolves.toMatchObject({profile});
    await expect(getPendingBayaanAuthState()).resolves.toBeNull();
  });

  it('clears an attempt that expires while the callback is handled', async () => {
    await savePendingBayaanAuthState({
      state: 'state-123',
      expiresAt: Date.now() + 300_000,
    });
    const service = createBayaanAuthService({
      apiUrl,
      now: () => Date.now() + 600_000,
    });

    await expect(
      service.handleCallbackUrl(
        'bayaan://oauth/callback?handoff=handoff-123&state=state-123',
      ),
    ).rejects.toMatchObject({code: 'expired_state'});
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
      () => new BayaanBffClient(apiUrl).completeAuth('handoff', 'state', '01'.repeat(32)),
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

    await expect(client.startAuth('a'.repeat(64))).rejects.toMatchObject({
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

    const error = await client.startAuth('a'.repeat(64)).catch(value => value);
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

  it('does not persist an exchange that finishes after logout', async () => {
    await savePendingBayaanAuthState({state: 'state-123', expiresAt: Date.now() + 300_000});
    let release: ((response: Response) => void) | undefined;
    (global.fetch as jest.Mock).mockImplementationOnce(() => new Promise<Response>(resolve => {release = resolve;}));
    const service = createBayaanAuthService({apiUrl});
    const callback = service.handleCallbackUrl('bayaan://oauth/callback?handoff=handoff-123&state=state-123');
    const rejection = expect(callback).rejects.toMatchObject({code: 'access_denied'});
    for (let i = 0; i < 100 && !release; i++) await Promise.resolve();
    expect(release).toBeDefined();
    const logout = service.logout();
    release?.(jsonResponse({sessionToken: 'opaque-bayaan-session', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), profile}));
    await rejection;
    await logout;
    await expect(getBayaanSession()).resolves.toBeNull();
    await expect(getPendingBayaanAuthState()).resolves.toBeNull();
  });

  it.each(['cancel', 'success'])(
    'rejects callback consumers and duplicate URLs when logout interrupts SecureStore save (browser=%s)',
    async browserResult => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(
          jsonResponse({
            authorizationUrl: `${apiUrl}/v1/qf/auth/launch?state=state-123`,
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
        )
        .mockResolvedValueOnce(jsonResponse({success: true}));
      let releaseSave!: () => void;
      const saveReached = new Promise<void>(reached => {
        jest
          .mocked(SecureStore.setItemAsync)
          .mockImplementation(async (key, value) => {
            if (key === 'bayaan_qf_session_v1') {
              await new Promise<void>(resolve => {
                releaseSave = resolve;
                reached();
              });
            }
            mockSecureStore.set(key, value);
          });
      });
      const service = createBayaanAuthService({apiUrl});
      const url = 'bayaan://oauth/callback?handoff=handoff-123&state=state-123';
      const observe = (promise: Promise<unknown>) =>
        promise.then(
          session => ({session}),
          error => ({error}),
        );
      let delivered: Promise<unknown> | undefined;
      let duplicate: Promise<unknown> | undefined;
      mockOpenBrowserAsync.mockImplementationOnce(async () => {
        delivered = observe(service.handleCallbackUrl(url));
        duplicate = observe(service.handleCallbackUrl(url));
        return {type: browserResult, url};
      });
      const signingIn = observe(service.signIn());
      await saveReached;
      const logout = service.logout();
      await expect(service.handleCallbackUrl(url)).rejects.toMatchObject({
        code: 'access_denied',
      });
      releaseSave();
      const outcomes = await Promise.all([signingIn, delivered, duplicate]);
      expect(outcomes).toEqual(
        Array(3).fill({
          error: expect.objectContaining({code: 'access_denied'}),
        }),
      );
      await logout;
      await expect(getBayaanSession()).resolves.toBeNull();
      await expect(getPendingBayaanAuthState()).resolves.toBeNull();
      await expect(service.handleCallbackUrl(url)).rejects.toMatchObject({
        code: 'missing_state',
      });
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(global.fetch).toHaveBeenLastCalledWith(
        `${apiUrl}/v1/qf/auth/logout`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer opaque-bayaan-session',
          }),
        }),
      );
    },
  );

  it.each([false, true])(
    'drains a held session save despite failed pending deletion (final delete fails=%s)',
    async finalDeleteFails => {
      const initialError = new Error('initial pending deletion failed');
      const finalError = new Error('final pending deletion failed');
      const events: string[] = [];
      await savePendingBayaanAuthState({
        state: 'state-123',
        expiresAt: Date.now() + 300_000,
      });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(
          jsonResponse({
            sessionToken: 'opaque-bayaan-session',
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            profile,
          }),
        )
        .mockImplementationOnce(async () => {
          events.push('revoke');
          return jsonResponse({success: true});
        });
      let releaseSave!: () => void;
      const saveReached = new Promise<void>(reached => {
        jest
          .mocked(SecureStore.setItemAsync)
          .mockImplementationOnce(async (key, value) => {
            expect(key).toBe('bayaan_qf_session_v1');
            await new Promise<void>(resolve => {
              releaseSave = resolve;
              reached();
            });
            mockSecureStore.set(key, value);
            events.push('save settled');
          });
      });
      const observe = (promise: Promise<unknown>) =>
        promise.then(
          value => ({value}),
          error => ({error}),
        );
      const service = createBayaanAuthService({apiUrl});
      const url = 'bayaan://oauth/callback?handoff=handoff-123&state=state-123';
      const callback = observe(service.handleCallbackUrl(url));
      const duplicate = observe(service.handleCallbackUrl(url));
      await saveReached;
      let pendingDeletes = 0;
      let deletionReached!: () => void;
      const pendingDeleteReached = new Promise<void>(resolve => {
        deletionReached = resolve;
      });
      jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => {
        if (key === 'bayaan_qf_pending_state_v1') {
          pendingDeletes += 1;
          events.push(`pending delete ${pendingDeletes}`);
          if (pendingDeletes === 1) {
            deletionReached();
            throw initialError;
          }
          if (finalDeleteFails) throw finalError;
        } else {
          events.push('session delete');
        }
        mockSecureStore.delete(key);
      });
      let logoutSettled = false;
      const logout = service.logout();
      const outcome = observe(logout).then(result => {
        logoutSettled = true;
        return result;
      });
      expect(service.logout()).toBe(logout);
      await pendingDeleteReached;
      for (let i = 0; i < 20; i++) await Promise.resolve();
      expect(logoutSettled).toBe(false);
      expect(events).toEqual(['pending delete 1']);
      await expect(service.signIn()).rejects.toMatchObject({
        code: 'access_denied',
      });
      await expect(service.handleCallbackUrl(url)).rejects.toMatchObject({
        code: 'access_denied',
      });
      releaseSave();
      expect(await Promise.all([callback, duplicate])).toEqual(
        Array(2).fill({
          error: expect.objectContaining({code: 'access_denied'}),
        }),
      );
      const result = await outcome;
      if (finalDeleteFails) {
        expect(result).toEqual({error: expect.any(AggregateError)});
        expect(result).toMatchObject({
          error: {errors: [initialError, finalError]},
        });
      } else {
        expect(result).toEqual({error: initialError});
      }
      expect(events).toEqual([
        'pending delete 1',
        'save settled',
        'revoke',
        'session delete',
        'pending delete 2',
      ]);
      expect(global.fetch).toHaveBeenLastCalledWith(
        `${apiUrl}/v1/qf/auth/logout`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer opaque-bayaan-session',
          }),
        }),
      );
      await expect(getBayaanSession()).resolves.toBeNull();
      await expect(service.restore()).resolves.toBeNull();
      await expect(
        createBayaanAuthService({apiUrl}).restore(),
      ).resolves.toBeNull();
      await expect(service.handleCallbackUrl(url)).rejects.toMatchObject({
        code: 'missing_state',
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Cleanup errors must neither unlock a stale callback nor poison a new login.
      jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => {
        mockSecureStore.delete(key);
      });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(
          jsonResponse({
            authorizationUrl: `${apiUrl}/v1/qf/auth/launch?state=fresh-state`,
            state: 'fresh-state',
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            sessionToken: 'fresh-session',
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            profile,
          }),
        );
      mockOpenBrowserAsync.mockResolvedValueOnce({
        type: 'success',
        url: 'bayaan://oauth/callback?handoff=fresh-handoff&state=fresh-state',
      });
      await expect(service.signIn()).resolves.toMatchObject({
        token: 'fresh-session',
      });
      await expect(getBayaanSession()).resolves.toMatchObject({
        token: 'fresh-session',
      });
      await expect(getPendingBayaanAuthState()).resolves.toBeNull();
    },
  );

  it('surfaces final pending cleanup failure after revoking and clearing the session', async () => {
    await saveBayaanSession({
      token: 'opaque-bayaan-session',
      expiresAt: Date.now() + 3_600_000,
      profile,
    });
    const finalError = new Error('final pending deletion failed');
    let pendingDeletes = 0;
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => {
      if (key === 'bayaan_qf_pending_state_v1' && ++pendingDeletes === 2) {
        throw finalError;
      }
      mockSecureStore.delete(key);
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({success: true}),
    );
    const service = createBayaanAuthService({apiUrl});
    await expect(service.logout()).rejects.toBe(finalError);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await expect(getBayaanSession()).resolves.toBeNull();
    await expect(service.restore()).resolves.toBeNull();
  });

  it.each([false, true])(
    'drains a cancelled pending-state write before logout completes (reject=%s)',
    async rejectWrite => {
      const start = (state: string) =>
        jsonResponse({
          authorizationUrl: `${apiUrl}/v1/qf/auth/launch?state=${state}`,
          state,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        });
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        start('cancelled-state'),
      );
      let releaseSave!: () => void;
      const saveReached = new Promise<void>(reached => {
        jest
          .mocked(SecureStore.setItemAsync)
          .mockImplementationOnce(async (key, value) => {
            expect(key).toBe('bayaan_qf_pending_state_v1');
            await new Promise<void>(resolve => {
              releaseSave = resolve;
              reached();
            });
            mockSecureStore.set(key, value);
            if (rejectWrite) throw new Error('ambiguous storage failure');
          });
      });
      const service = createBayaanAuthService({apiUrl});
      const signingIn = service.signIn().catch(error => error);
      await saveReached;
      let loggedOut = false;
      const logout = service.logout().then(() => {
        loggedOut = true;
      });
      for (let i = 0; i < 20; i++) await Promise.resolve();
      expect(loggedOut).toBe(false);
      const url =
        'bayaan://oauth/callback?handoff=old-handoff&state=cancelled-state';
      await expect(service.handleCallbackUrl(url)).rejects.toMatchObject({
        code: 'access_denied',
      });
      releaseSave();
      await logout;
      expect(await signingIn).toMatchObject({
        code: rejectWrite ? 'network_error' : 'access_denied',
      });
      expect(mockOpenBrowserAsync).not.toHaveBeenCalled();
      expect(mockSecureStore.has('bayaan_qf_pending_state_v1')).toBe(false);
      await expect(getPendingBayaanAuthState()).resolves.toBeNull();
      await expect(getBayaanSession()).resolves.toBeNull();
      // A fresh router delivery has the post-logout generation, not the
      // generation captured by signIn or an already queued callback.
      await expect(service.handleCallbackUrl(url)).rejects.toMatchObject({
        code: 'missing_state',
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(start('fresh-state'))
        .mockResolvedValueOnce(
          jsonResponse({
            sessionToken: 'fresh-session',
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            profile,
          }),
        );
      mockOpenBrowserAsync.mockResolvedValueOnce({
        type: 'success',
        url: 'bayaan://oauth/callback?handoff=fresh-handoff&state=fresh-state',
      });
      await expect(service.signIn()).resolves.toMatchObject({
        token: 'fresh-session',
      });
      expect(mockOpenBrowserAsync).toHaveBeenCalledTimes(1);
      await expect(getPendingBayaanAuthState()).resolves.toBeNull();
      await expect(getBayaanSession()).resolves.toMatchObject({
        token: 'fresh-session',
      });
    },
  );

  it('rejects a cancelled stored attempt even if pending-state deletion fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        authorizationUrl: `${apiUrl}/v1/qf/auth/launch?state=cancelled-state`,
        state: 'cancelled-state',
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      }),
    );
    let releaseBrowser!: (result: unknown) => void;
    const browserReached = new Promise<void>(reached => {
      mockOpenBrowserAsync.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            releaseBrowser = resolve;
            reached();
          }),
      );
    });
    const service = createBayaanAuthService({apiUrl});
    const signingIn = service.signIn().catch(error => error);
    await browserReached;
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => {
      if (key === 'bayaan_qf_pending_state_v1') {
        throw new Error('storage unavailable');
      }
      mockSecureStore.delete(key);
    });
    await expect(service.logout()).rejects.toMatchObject({
      name: 'AggregateError',
      errors: [
        expect.objectContaining({message: 'storage unavailable'}),
        expect.objectContaining({message: 'storage unavailable'}),
      ],
    });
    await expect(
      service.handleCallbackUrl(
        'bayaan://oauth/callback?handoff=old-handoff&state=cancelled-state',
      ),
    ).rejects.toMatchObject({code: 'access_denied'});
    expect(global.fetch).toHaveBeenCalledTimes(1);
    releaseBrowser({type: 'cancel'});
    expect(await signingIn).toMatchObject({code: 'access_denied'});
  });

  it('does not wait for an open browser or let its cancelled completion unlock a newer sign-in', async () => {
    (global.fetch as jest.Mock).mockImplementation(async () =>
      jsonResponse({
        authorizationUrl: `${apiUrl}/v1/qf/auth/launch?state=state-123`,
        state: 'state-123',
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      }),
    );
    const releases: Array<(result: unknown) => void> = [];
    mockOpenBrowserAsync.mockImplementation(
      () =>
        new Promise(resolve => {
          releases.push(resolve);
        }),
    );
    const service = createBayaanAuthService({apiUrl});
    const cancelled = service.signIn().catch(error => error);
    for (let i = 0; i < 100 && releases.length < 1; i++)
      await Promise.resolve();
    expect(releases).toHaveLength(1);
    await service.logout();
    const fresh = service.signIn();
    const rejected = fresh.catch(error => error);
    for (let i = 0; i < 100 && releases.length < 2; i++)
      await Promise.resolve();
    expect(releases).toHaveLength(2);
    releases[0]({type: 'cancel'});
    expect(await cancelled).toMatchObject({code: 'access_denied'});
    expect(service.signIn()).toBe(fresh);
    await expect(getPendingBayaanAuthState()).resolves.toMatchObject({
      state: 'state-123',
    });
    releases[1]({type: 'cancel'});
    expect(await rejected).toMatchObject({code: 'access_denied'});
    await expect(getPendingBayaanAuthState()).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('generation-checks even a cached duplicate before delivering success', async () => {
    await savePendingBayaanAuthState({
      state: 'state-123',
      expiresAt: Date.now() + 300_000,
    });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        jsonResponse({
          sessionToken: 'opaque-bayaan-session',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          profile,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({success: true}));
    const service = createBayaanAuthService({apiUrl});
    const url = 'bayaan://oauth/callback?handoff=handoff-123&state=state-123';
    await service.handleCallbackUrl(url);
    const duplicate = service.handleCallbackUrl(url);
    const rejection = expect(duplicate).rejects.toMatchObject({
      code: 'access_denied',
    });
    const logout = service.logout();
    await rejection;
    await logout;
    await expect(service.handleCallbackUrl(url)).rejects.toMatchObject({
      code: 'missing_state',
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // Restore/session-queue and prior-process proof regressions.
  it.each(['success', 'revoked', 'offline'])(
    'ignores delayed restore %s after login B persists its session',
    async result => {
      await saveBayaanSession({
        token: 'session-A',
        expiresAt: Date.now() + 3_600_000,
        profile: {accountId: 'account-A'},
      });
      let release!: (response: Response) => void;
      let reject!: (error: unknown) => void;
      const restoreReached = new Promise<void>(reached => {
        (global.fetch as jest.Mock).mockImplementationOnce(
          () =>
            new Promise<Response>((resolve, rejectPromise) => {
              release = resolve;
              reject = rejectPromise;
              reached();
            }),
        );
      });
      const service = createBayaanAuthService({apiUrl});
      const restoring = service.restore();
      await restoreReached;
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(
          jsonResponse({
            authorizationUrl: `${apiUrl}/v1/qf/auth/launch?state=state-B`,
            state: 'state-B',
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            sessionToken: 'session-B',
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            profile: {accountId: 'account-B'},
          }),
        );
      mockOpenBrowserAsync.mockResolvedValueOnce({
        type: 'success',
        url: 'bayaan://oauth/callback?handoff=handoff-B&state=state-B',
      });
      await expect(service.signIn()).resolves.toMatchObject({
        token: 'session-B',
      });
      if (result === 'offline') reject(new TypeError('offline'));
      else
        release(
          result === 'revoked'
            ? jsonResponse({error: {code: 'UNAUTHORIZED'}}, 401)
            : jsonResponse({
                expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
                profile: {accountId: 'account-A'},
              }),
        );
      await expect(restoring).resolves.toBeNull();
      await expect(getBayaanSession()).resolves.toMatchObject({
        token: 'session-B',
        profile: {accountId: 'account-B'},
      });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    },
  );

  it.each(['callback', 'logout'])(
    'drains a held restore session save before %s final storage mutation',
    async successor => {
      await saveBayaanSession({
        token: 'session-A',
        expiresAt: Date.now() + 3_600_000,
        profile: {accountId: 'account-A'},
      });
      await savePendingBayaanAuthState({
        state: 'cold-state',
        expiresAt: Date.now() + 300_000,
      });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(
          jsonResponse({
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            profile: {accountId: 'account-A', name: 'Fresh A'},
          }),
        )
        .mockResolvedValueOnce(
          successor === 'logout'
            ? jsonResponse({success: true})
            : jsonResponse({
                sessionToken: 'session-B',
                expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
                profile: {accountId: 'account-B'},
              }),
        );
      let releaseSave!: () => void;
      const saveReached = new Promise<void>(reached => {
        jest
          .mocked(SecureStore.setItemAsync)
          .mockImplementationOnce(async (key, value) => {
            expect(key).toBe('bayaan_qf_session_v1');
            await new Promise<void>(resolve => {
              releaseSave = resolve;
              reached();
            });
            mockSecureStore.set(key, value);
          });
      });
      const service = createBayaanAuthService({apiUrl});
      const restoring = service.restore();
      await saveReached;
      let settled = false;
      const next = (
        successor === 'logout'
          ? service.logout()
          : service.handleCallbackUrl(
              'bayaan://oauth/callback?handoff=cold-handoff&state=cold-state',
            )
      ).then(value => {
        settled = true;
        return value;
      });
      for (let i = 0; i < 100; i++) await Promise.resolve();
      expect(settled).toBe(false);
      releaseSave();
      await expect(restoring).resolves.toBeNull();
      await next;
      if (successor === 'logout') {
        await expect(getBayaanSession()).resolves.toBeNull();
        expect(global.fetch).toHaveBeenLastCalledWith(
          `${apiUrl}/v1/qf/auth/logout`,
          expect.objectContaining({
            headers: {Authorization: 'Bearer session-A'},
          }),
        );
      } else {
        await expect(getBayaanSession()).resolves.toMatchObject({
          token: 'session-B',
        });
        expect(mockOpenBrowserAsync).not.toHaveBeenCalled();
      }
      expect(global.fetch).toHaveBeenCalledTimes(2);
    },
  );

  it.each([false, true])(
    'revokes prior-process proof despite failed logout deletes (read fails=%s)',
    async readFails => {
      await savePendingBayaanAuthState({
        state: 'cold-state',
        expiresAt: Date.now() + 300_000,
      });
      const readError = new Error('pending read failed');
      const deleteError = new Error('pending delete failed');
      jest.mocked(SecureStore.getItemAsync).mockImplementation(async key => {
        if (readFails && key === 'bayaan_qf_pending_state_v1') throw readError;
        return mockSecureStore.get(key) ?? null;
      });
      jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => {
        if (key === 'bayaan_qf_pending_state_v1') throw deleteError;
        mockSecureStore.delete(key);
      });
      const service = createBayaanAuthService({apiUrl});
      await expect(service.logout()).rejects.toMatchObject({
        errors: readFails
          ? [readError, deleteError, deleteError]
          : [deleteError, deleteError],
      });
      jest
        .mocked(SecureStore.getItemAsync)
        .mockImplementation(async key => mockSecureStore.get(key) ?? null);
      jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => {
        mockSecureStore.delete(key);
      });
      await expect(getPendingBayaanAuthState()).resolves.toMatchObject({
        state: 'cold-state',
      });
      await expect(
        service.handleCallbackUrl(
          'bayaan://oauth/callback?handoff=cold-handoff&state=cold-state',
        ),
      ).rejects.toMatchObject({code: 'access_denied'});
      await expect(service.restore()).resolves.toBeNull();
      await expect(getBayaanSession()).resolves.toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();

      // The process-local fail-closed gate does not block a new local proof.
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(
          jsonResponse({
            authorizationUrl: `${apiUrl}/v1/qf/auth/launch?state=fresh-state`,
            state: 'fresh-state',
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            sessionToken: 'fresh-session',
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            profile,
          }),
        );
      mockOpenBrowserAsync.mockResolvedValueOnce({
        type: 'success',
        url: 'bayaan://oauth/callback?handoff=fresh-handoff&state=fresh-state',
      });
      await expect(service.signIn()).resolves.toMatchObject({
        token: 'fresh-session',
      });
    },
  );

  it.each(['provider error', 'missing handoff', 'expired', 'consume failure'])(
    'tombstones a matched cold-start %s before failed pending cleanup',
    async failure => {
      const expiresAt = Date.now() + 300_000;
      await savePendingBayaanAuthState({state: 'cold-state', expiresAt});
      const storageError = new Error('pending delete failed');
      let releaseDelete!: () => void;
      const deleteReached = new Promise<void>(reached => {
        jest
          .mocked(SecureStore.deleteItemAsync)
          .mockImplementation(async key => {
            if (key === 'bayaan_qf_pending_state_v1') {
              if (!releaseDelete) {
                await new Promise<void>(resolve => {
                  releaseDelete = resolve;
                  reached();
                });
              }
              throw storageError;
            }
            mockSecureStore.delete(key);
          });
      });
      const service = createBayaanAuthService({
        apiUrl,
        now: () => (failure === 'expired' ? expiresAt + 1 : Date.now()),
      });
      const validUrl =
        'bayaan://oauth/callback?handoff=cold-handoff&state=cold-state';
      const url =
        failure === 'provider error'
          ? 'bayaan://oauth/callback?error=access_denied&state=cold-state'
          : failure === 'missing handoff'
            ? 'bayaan://oauth/callback?state=cold-state'
            : validUrl;
      const failed = service.handleCallbackUrl(url).catch(error => error);
      await deleteReached;
      const delayed = service.handleCallbackUrl(validUrl).catch(error => error);
      releaseDelete();
      expect(await failed).toBe(storageError);
      expect(await delayed).toMatchObject({
        ...(failure === 'consume failure' || failure === 'expired'
          ? {message: storageError.message}
          : {code: 'access_denied'}),
      });
      jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => {
        mockSecureStore.delete(key);
      });
      await expect(service.handleCallbackUrl(validUrl)).rejects.toMatchObject({
        code: 'access_denied',
      });
      await expect(getPendingBayaanAuthState()).resolves.toMatchObject({
        state: 'cold-state',
      });
      await expect(getBayaanSession()).resolves.toBeNull();
      await expect(service.restore()).resolves.toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockOpenBrowserAsync).not.toHaveBeenCalled();
    },
  );

  // End restore/session-queue and prior-process proof regressions.
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
