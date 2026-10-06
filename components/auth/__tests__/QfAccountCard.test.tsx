const mockOpenBrowserAsync = jest.fn();
const mockDismissBrowser = jest.fn();
const mockSecureStore = new Map<string, string>();
const mockUseLinkingURL = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-linking', () => ({
  useLinkingURL: () => mockUseLinkingURL(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({replace: mockReplace}),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: (...args: unknown[]) => mockOpenBrowserAsync(...args),
  dismissBrowser: () => mockDismissBrowser(),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async () => new Uint8Array(32).fill(1),
  CryptoDigestAlgorithm: {SHA256: 'SHA-256'},
  digestStringAsync: async () => 'a'.repeat(64),
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

jest.mock('@/services/settings/qfSettingsSyncLifecycle', () => ({
  qfSettingsSyncLifecycle: {stop: jest.fn(async () => undefined)},
}));

jest.mock('@/config/bayaanAuth', () => ({
  bayaanAuthConfig: {
    apiUrl: 'https://api-prelive.thebayaan.com',
    qfSyncEnabled: true,
  },
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#FFFFFF',
        error: '#FF0000',
        text: '#111111',
        textSecondary: '#555555',
      },
    },
  }),
}));

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {QfAccountCard} from '../QfAccountCard';
import OAuthCallbackScreen from '@/app/oauth/callback';
import {
  bayaanAuthService,
  createBayaanAuthService,
} from '@/services/auth/bayaanAuthService';
import {
  getBayaanSession,
  getPendingBayaanAuthState,
  saveBayaanSession,
  savePendingBayaanAuthState,
} from '@/services/auth/bayaanSessionStorage';
import {BayaanAuthProvider} from '@/providers/BayaanAuthProvider';
import {qfSyncLifecycle} from '@/services/sync/qfSyncLifecycle';
import {qfSettingsSyncLifecycle} from '@/services/settings/qfSettingsSyncLifecycle';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';

function findButton(screen: renderer.ReactTestRenderer) {
  return screen.root.find(node => typeof node.props.onPress === 'function');
}

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

beforeEach(async () => {
  jest.restoreAllMocks();
  mockUseLinkingURL.mockReset();
  mockReplace.mockReset();
  mockSecureStore.clear();
  await bayaanAuthService.logout();
  mockOpenBrowserAsync.mockReset();
  mockDismissBrowser.mockReset();
  mockSecureStore.clear();
  await act(async () => {
    useBayaanAuthStore.getState().resetForTesting();
    useBayaanAuthStore.getState().setSignedOut();
  });
  global.fetch = jest.fn();
});

describe('QfAccountCard', () => {
  it.each(['offline revocation', 'secure cleanup'])(
    'handles logout rejection from %s without leaking a press-handler rejection',
    async reason => {
      jest.spyOn(qfSyncLifecycle, 'stop').mockResolvedValue();
      jest
        .spyOn(bayaanAuthService, 'logout')
        .mockRejectedValueOnce(new Error(reason));
      useBayaanAuthStore.getState().setAuthenticated({accountId: 'account-A'});
      let card!: renderer.ReactTestRenderer;
      await act(async () => {
        card = renderer.create(<QfAccountCard />);
      });
      await act(async () => {
        await expect(findButton(card).props.onPress()).resolves.toBeUndefined();
      });
      expect(useBayaanAuthStore.getState().status).toBe('signed_out');
      expect(qfSettingsSyncLifecycle.stop).toHaveBeenCalledWith(true);
      await act(async () => card.unmount());
    },
  );
  it.each(['success', 'revoked'])(
    'keeps cold-start callback B in real provider/store/storage after delayed restore %s',
    async result => {
      await saveBayaanSession({
        token: 'session-A',
        expiresAt: Date.now() + 3_600_000,
        profile: {accountId: 'account-A'},
      });
      await savePendingBayaanAuthState({
        state: 'cold-state',
        deviceVerifier: '01'.repeat(32),
        expiresAt: Date.now() + 300_000,
      });
      const service = createBayaanAuthService({
        apiUrl: 'https://api-prelive.thebayaan.com',
      });
      jest
        .spyOn(bayaanAuthService, 'restore')
        .mockImplementation(service.restore);
      jest
        .spyOn(bayaanAuthService, 'handleCallbackUrl')
        .mockImplementation(service.handleCallbackUrl);
      let releaseRestore!: (response: Response) => void;
      const restoreReached = new Promise<void>(reached => {
        (global.fetch as jest.Mock).mockImplementationOnce(
          () =>
            new Promise<Response>(resolve => {
              releaseRestore = resolve;
              reached();
            }),
        );
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        jsonResponse({
          sessionToken: 'session-B',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          profile: {accountId: 'account-B'},
        }),
      );
      useBayaanAuthStore.getState().setInitializing();
      let provider!: renderer.ReactTestRenderer;
      let callback!: renderer.ReactTestRenderer;
      await act(async () => {
        provider = renderer.create(
          <BayaanAuthProvider>{null}</BayaanAuthProvider>,
        );
      });
      await restoreReached;
      mockUseLinkingURL.mockReturnValue(
        'bayaan://oauth/callback?handoff=cold-handoff&state=cold-state',
      );
      await act(async () => {
        callback = renderer.create(<OAuthCallbackScreen />);
      });
      await expect(getBayaanSession()).resolves.toMatchObject({
        token: 'session-B',
      });
      await act(async () => {
        releaseRestore(
          result === 'revoked'
            ? jsonResponse({error: {code: 'UNAUTHORIZED'}}, 401)
            : jsonResponse({
                expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
                profile: {accountId: 'account-A'},
              }),
        );
      });
      expect(useBayaanAuthStore.getState()).toMatchObject({
        status: 'authenticated',
        profile: {accountId: 'account-B'},
        errorCode: null,
      });
      await expect(getBayaanSession()).resolves.toMatchObject({
        token: 'session-B',
        profile: {accountId: 'account-B'},
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(mockOpenBrowserAsync).not.toHaveBeenCalled();
      await act(async () => {
        callback.unmount();
        provider.unmount();
      });
    },
  );

  it('returns to a retryable sign-in state when the auth browser is cancelled', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        authorizationUrl:
          'https://api-prelive.thebayaan.com/v1/qf/auth/launch?state=state-123',
        state: 'state-123',
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      }),
    );
    mockOpenBrowserAsync.mockResolvedValueOnce({type: 'cancel'});

    let screen: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      screen = renderer.create(<QfAccountCard />);
    });

    if (!screen) {
      throw new Error('Expected account card to render');
    }

    const renderedScreen = screen;
    const signInButton = findButton(renderedScreen);
    await act(async () => {
      await signInButton.props.onPress();
    });

    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'error',
      errorCode: 'access_denied',
    });
    await expect(getPendingBayaanAuthState()).resolves.toBeNull();
    expect(findButton(renderedScreen).props.disabled).toBe(false);
    expect(
      renderedScreen.root.findAllByProps({children: 'Sign in'}).length,
    ).toBeGreaterThan(0);
    await act(async () => {
      renderedScreen.unmount();
    });
  });

  it('keeps authenticated state when callback completion causes the browser to dismiss', async () => {
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
          profile: {
            accountId: 'bayaan-account-id',
            email: 'reader@example.test',
            name: 'Reader',
          },
        }),
      );

    let screen: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      screen = renderer.create(<QfAccountCard />);
    });
    if (!screen) {
      throw new Error('Expected account card to render');
    }

    const renderedScreen = screen;
    const signInButton = findButton(renderedScreen);
    let signInPromise: Promise<unknown> = Promise.resolve();
    await act(async () => {
      signInPromise = signInButton.props.onPress();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const attempt = useBayaanAuthStore.getState().authAttempt;
    let callback!: renderer.ReactTestRenderer;
    mockUseLinkingURL.mockReturnValue(
      'bayaan://oauth/callback?handoff=handoff-123&state=state-123',
    );
    await act(async () => {
      callback = renderer.create(<OAuthCallbackScreen />);
    });
    expect(useBayaanAuthStore.getState().authAttempt).toBe(attempt);

    await act(async () => callback.unmount());
    resolveBrowser({type: 'dismiss'});
    await act(async () => {
      await signInPromise;
    });

    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      profile: {
        accountId: 'bayaan-account-id',
      },
      errorCode: null,
    });
    await act(async () => {
      renderedScreen.unmount();
    });
  });

  it.each([
    ['cancel', false],
    ['success', true],
  ] as const)(
    'ignores superseded browser %s after router A, logout and login B (remount=%s)',
    async (browserResult, remount) => {
      jest.spyOn(qfSyncLifecycle, 'stop').mockResolvedValue();
      const start = (state: string) =>
        jsonResponse({
          authorizationUrl: `https://api-prelive.thebayaan.com/v1/qf/auth/launch?state=${state}`,
          state,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        });
      const session = (accountId: string) =>
        jsonResponse({
          sessionToken: `opaque-${accountId}`,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          profile: {accountId},
        });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(start('state-A'))
        .mockResolvedValueOnce(session('account-A'))
        .mockResolvedValueOnce(jsonResponse({success: true}))
        .mockResolvedValueOnce(start('state-B'))
        .mockResolvedValueOnce(session('account-B'));
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
      let card!: renderer.ReactTestRenderer;
      let callback!: renderer.ReactTestRenderer;
      await act(async () => {
        card = renderer.create(<QfAccountCard />);
      });
      let oldSignIn!: Promise<void>;
      await act(async () => {
        oldSignIn = findButton(card).props.onPress();
        await browserReached;
      });
      mockUseLinkingURL.mockReturnValue(
        'bayaan://oauth/callback?handoff=handoff-A&state=state-A',
      );
      await act(async () => {
        callback = renderer.create(<OAuthCallbackScreen />);
      });
      expect(useBayaanAuthStore.getState()).toMatchObject({
        status: 'authenticated',
        profile: {accountId: 'account-A'},
      });
      await act(async () => {
        await findButton(card).props.onPress();
        callback.unmount();
        if (remount) {
          card.unmount();
          card = renderer.create(<QfAccountCard />);
        }
      });
      mockOpenBrowserAsync.mockResolvedValueOnce({
        type: 'success',
        url: 'bayaan://oauth/callback?handoff=handoff-B&state=state-B',
      });
      await act(async () => {
        await findButton(card).props.onPress();
      });
      const transitions: string[] = [];
      const unsubscribe = useBayaanAuthStore.subscribe(auth => {
        transitions.push(
          `${auth.status}:${auth.profile?.accountId ?? 'guest'}`,
        );
      });
      await act(async () => {
        releaseBrowser({
          type: browserResult,
          url: 'bayaan://oauth/callback?handoff=handoff-A&state=state-A',
        });
        await oldSignIn;
      });
      unsubscribe();
      expect(transitions).toEqual([]); // No bridge transition into guest scope.
      expect(useBayaanAuthStore.getState()).toMatchObject({
        status: 'authenticated',
        profile: {accountId: 'account-B'},
        errorCode: null,
      });
      expect(
        card.root.findAllByProps({children: 'Sign out'}).length,
      ).toBeGreaterThan(0);
      expect(global.fetch).toHaveBeenCalledTimes(5);
      await act(async () => card.unmount());
    },
  );

  it.each(['success', 'error'])(
    'guards a retained card handler even if an obsolete service result is %s',
    async result => {
      let release!: (
        session: Awaited<ReturnType<typeof bayaanAuthService.signIn>>,
      ) => void;
      let reject!: (error: unknown) => void;
      jest.spyOn(bayaanAuthService, 'signIn').mockImplementationOnce(
        () =>
          new Promise((resolve, rejectPromise) => {
            release = resolve;
            reject = rejectPromise;
          }),
      );
      let card!: renderer.ReactTestRenderer;
      await act(async () => {
        card = renderer.create(<QfAccountCard />);
      });
      let oldSignIn!: Promise<void>;
      await act(async () => {
        oldSignIn = findButton(card).props.onPress();
      });
      await act(async () => {
        card.unmount();
        useBayaanAuthStore.getState().setSignedOut();
        const attempt = useBayaanAuthStore.getState().setSigningIn();
        useBayaanAuthStore
          .getState()
          .setAuthenticated({accountId: 'account-B'}, attempt);
        card = renderer.create(<QfAccountCard />);
      });
      await act(async () => {
        if (result === 'success') {
          release({
            token: 'old-opaque-session',
            expiresAt: Date.now() + 3_600_000,
            profile: {accountId: 'account-A'},
          });
        } else reject(new Error('obsolete browser failure'));
        await oldSignIn;
      });
      expect(useBayaanAuthStore.getState()).toMatchObject({
        status: 'authenticated',
        profile: {accountId: 'account-B'},
        errorCode: null,
      });
      await act(async () => card.unmount());
    },
  );

  it('does not let an obsolete sign-out finally overwrite a newer login', async () => {
    jest.spyOn(qfSyncLifecycle, 'stop').mockResolvedValue();
    let releaseLogout!: () => void;
    jest.spyOn(bayaanAuthService, 'logout').mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          releaseLogout = resolve;
        }),
    );
    useBayaanAuthStore.getState().setAuthenticated({accountId: 'account-A'});
    let card!: renderer.ReactTestRenderer;
    await act(async () => {
      card = renderer.create(<QfAccountCard />);
    });
    let signOut!: Promise<void>;
    await act(async () => {
      signOut = findButton(card).props.onPress();
    });
    await act(async () => {
      const attempt = useBayaanAuthStore.getState().setSigningIn();
      useBayaanAuthStore
        .getState()
        .setAuthenticated({accountId: 'account-B'}, attempt);
      releaseLogout();
      await signOut;
    });
    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      profile: {accountId: 'account-B'},
    });
    await act(async () => card.unmount());
  });

  it('stops account lifecycle work before logging out', async () => {
    const events: string[] = [];
    jest.spyOn(qfSyncLifecycle, 'stop').mockImplementation(async () => {
      events.push('stop');
    });
    jest.spyOn(bayaanAuthService, 'logout').mockImplementation(async () => {
      events.push('logout');
    });
    useBayaanAuthStore.getState().setAuthenticated({
      accountId: 'bayaan-account-id',
    });

    let screen: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      screen = renderer.create(<QfAccountCard />);
    });
    if (!screen) throw new Error('Expected account card to render');

    const renderedScreen = screen;
    await act(async () => {
      await findButton(renderedScreen).props.onPress();
    });

    expect(events).toEqual(['stop', 'logout']);
    expect(useBayaanAuthStore.getState().status).toBe('signed_out');
    await act(async () => {
      renderedScreen.unmount();
    });
  });
});
