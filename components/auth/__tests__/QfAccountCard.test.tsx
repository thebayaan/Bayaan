const mockOpenBrowserAsync = jest.fn();
const mockDismissBrowser = jest.fn();
const mockSecureStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

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
import {bayaanAuthService} from '@/services/auth/bayaanAuthService';
import {getPendingBayaanAuthState} from '@/services/auth/bayaanSessionStorage';
import {qfSyncLifecycle} from '@/services/sync/qfSyncLifecycle';
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

beforeEach(() => {
  mockOpenBrowserAsync.mockReset();
  mockDismissBrowser.mockReset();
  mockSecureStore.clear();
  useBayaanAuthStore.getState().resetForTesting();
  useBayaanAuthStore.getState().setSignedOut();
  global.fetch = jest.fn();
});

describe('QfAccountCard', () => {
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

    await act(async () => {
      const session = await bayaanAuthService.handleCallbackUrl(
        'bayaan://oauth/callback?handoff=handoff-123&state=state-123',
      );
      useBayaanAuthStore.getState().setAuthenticated(session.profile);
    });

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
