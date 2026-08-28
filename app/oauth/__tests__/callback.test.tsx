const mockHandleCallbackUrl = jest.fn();
const mockReplace = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockUseLinkingURL = jest.fn();

jest.mock('expo-linking', () => ({
  useLinkingURL: () => mockUseLinkingURL(),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({replace: mockReplace}),
}));

jest.mock('@/services/auth/bayaanAuthService', () => ({
  BayaanAuthError: class BayaanAuthError extends Error {
    code: string;

    constructor(mockCode: string, message: string) {
      super(message);
      this.code = mockCode;
      this.name = 'BayaanAuthError';
    }
  },
  bayaanAuthService: {
    handleCallbackUrl: (...args: unknown[]) => mockHandleCallbackUrl(...args),
  },
}));

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import OAuthCallbackScreen from '../callback';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';

beforeEach(() => {
  mockHandleCallbackUrl.mockReset();
  mockHandleCallbackUrl.mockResolvedValue({
    profile: {accountId: 'account-1'},
  });
  mockReplace.mockReset();
  mockUseLocalSearchParams.mockReset();
  mockUseLinkingURL.mockReset();
  mockUseLinkingURL.mockReturnValue(null);
  useBayaanAuthStore.getState().resetForTesting();
});

describe('OAuth callback route', () => {
  it('processes the native current link synchronously', async () => {
    mockUseLinkingURL.mockReturnValue('current-callback');

    await act(async () => {
      renderer.create(<OAuthCallbackScreen />);
      await Promise.resolve();
    });

    expect(mockHandleCallbackUrl).toHaveBeenCalledTimes(1);
  });

  it('waits for a callback URL after an initial null and authenticates exactly once', async () => {
    const callbackUrl =
      'bayaan://oauth/callback?handoff=handoff-123&state=state-123';
    mockUseLinkingURL.mockReturnValueOnce(null).mockReturnValue(callbackUrl);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OAuthCallbackScreen />);
      await Promise.resolve();
    });

    expect(mockHandleCallbackUrl).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(useBayaanAuthStore.getState().status).toBe('initializing');

    await act(async () => {
      tree.update(<OAuthCallbackScreen />);
      await Promise.resolve();
    });

    await act(async () => {
      tree.update(<OAuthCallbackScreen />);
      await Promise.resolve();
    });

    expect(mockHandleCallbackUrl).toHaveBeenCalledTimes(1);
    expect(mockHandleCallbackUrl).toHaveBeenCalledWith(callbackUrl);
    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      profile: {accountId: 'account-1'},
      errorCode: null,
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/(d.settings)');
  });

  it('passes the original inbound URL to callback validation without rebuilding it from params', async () => {
    const originalUrl =
      'bayaan://quran/1?handoff=handoff-123&state=state-123#access_token=secret';
    mockUseLinkingURL.mockReturnValue(originalUrl);
    mockUseLocalSearchParams.mockReturnValue({
      handoff: 'handoff-123',
      state: 'state-123',
    });
    mockHandleCallbackUrl.mockRejectedValueOnce(new Error('invalid route'));

    await act(async () => {
      renderer.create(<OAuthCallbackScreen />);
      await Promise.resolve();
    });

    expect(mockHandleCallbackUrl).toHaveBeenCalledWith(originalUrl);
  });

  it('fails closed after a bounded wait when no callback URL arrives', async () => {
    jest.useFakeTimers();
    try {
      mockUseLinkingURL.mockReturnValue(null);
      mockUseLocalSearchParams.mockReturnValue({
        handoff: 'handoff-123',
        state: 'state-123',
      });

      await act(async () => {
        renderer.create(<OAuthCallbackScreen />);
        await Promise.resolve();
      });

      expect(mockHandleCallbackUrl).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
      expect(useBayaanAuthStore.getState().status).toBe('initializing');

      await act(async () => {
        await jest.advanceTimersByTimeAsync(5_000);
      });

      expect(mockHandleCallbackUrl).not.toHaveBeenCalled();
      expect(useBayaanAuthStore.getState()).toMatchObject({
        status: 'error',
        errorCode: 'malformed_callback',
      });
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/(d.settings)');
    } finally {
      jest.useRealTimers();
    }
  });
});
