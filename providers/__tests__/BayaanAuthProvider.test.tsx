const mockRestore = jest.fn();

jest.mock('@/services/auth/bayaanAuthService', () => ({
  bayaanAuthService: {
    restore: () => mockRestore(),
  },
}));

import React from 'react';
import {Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {BayaanAuthProvider} from '../BayaanAuthProvider';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';

beforeEach(() => {
  mockRestore.mockReset();
  useBayaanAuthStore.getState().resetForTesting();
});

describe('BayaanAuthProvider', () => {
  it('restores a valid stored BFF session into profile-only app state', async () => {
    mockRestore.mockResolvedValueOnce({
      token: 'opaque-token-that-must-not-enter-zustand',
      expiresAt: Date.now() + 60_000,
      profile: {accountId: 'account-1', email: 'reader@example.test'},
    });

    await act(async () => {
      renderer.create(
        <BayaanAuthProvider>
          <Text>child</Text>
        </BayaanAuthProvider>,
      );
    });

    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      profile: {accountId: 'account-1', email: 'reader@example.test'},
    });
    expect(JSON.stringify(useBayaanAuthStore.getState())).not.toContain(
      'opaque-token-that-must-not-enter-zustand',
    );
  });

  it('keeps the app usable as signed out when restore fails', async () => {
    mockRestore.mockRejectedValueOnce(new Error('network is down'));

    await act(async () => {
      renderer.create(
        <BayaanAuthProvider>
          <Text>child</Text>
        </BayaanAuthProvider>,
      );
    });

    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'signed_out',
      profile: null,
    });
  });
});
