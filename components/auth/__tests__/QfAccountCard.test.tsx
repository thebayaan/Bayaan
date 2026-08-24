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
import {getPendingBayaanAuthState} from '@/services/auth/bayaanSessionStorage';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';

function findButton(screen: renderer.ReactTestRenderer) {
  return screen.root.find(node => typeof node.props.onPress === 'function');
}

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

    const signInButton = findButton(screen);
    await act(async () => {
      await signInButton.props.onPress();
    });

    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'error',
      errorCode: 'access_denied',
    });
    await expect(getPendingBayaanAuthState()).resolves.toBeNull();
    expect(findButton(screen).props.disabled).toBe(false);
    expect(
      screen.root.findAllByProps({children: 'Sign in'}).length,
    ).toBeGreaterThan(0);
  });
});
