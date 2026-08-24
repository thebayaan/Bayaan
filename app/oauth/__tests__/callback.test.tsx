const mockHandleCallbackUrl = jest.fn();
const mockReplace = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockUseURL = jest.fn();

jest.mock('expo-linking', () => ({
  useURL: () => mockUseURL(),
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
  mockUseURL.mockReset();
  useBayaanAuthStore.getState().resetForTesting();
});

describe('OAuth callback route', () => {
  it('passes the original inbound URL to callback validation without rebuilding it from params', async () => {
    const originalUrl =
      'bayaan://quran/1?handoff=handoff-123&state=state-123#access_token=secret';
    mockUseURL.mockReturnValue(originalUrl);
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

  it('rejects missing original callback URLs instead of reconstructing a sanitized callback', async () => {
    mockUseURL.mockReturnValue(null);
    mockUseLocalSearchParams.mockReturnValue({
      handoff: 'handoff-123',
      state: 'state-123',
    });

    await act(async () => {
      renderer.create(<OAuthCallbackScreen />);
      await Promise.resolve();
    });

    expect(mockHandleCallbackUrl).not.toHaveBeenCalled();
    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'error',
      errorCode: 'malformed_callback',
    });
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/(d.settings)');
  });
});
