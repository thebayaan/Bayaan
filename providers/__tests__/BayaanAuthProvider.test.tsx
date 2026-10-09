const mockRestore = jest.fn();

jest.mock('@/services/auth/bayaanAuthService', () => ({
  bayaanAuthService: {
    restore: (onStored: unknown) => mockRestore(onStored),
  },
}));

import React from 'react';
import {AppState, Text, type AppStateStatus} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {BayaanAuthProvider} from '../BayaanAuthProvider';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';

beforeEach(() => {
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation(() => ({remove: jest.fn()}));
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

  it.each(['session', 'empty', 'error'])(
    'ignores obsolete startup restore %s after logout and a new login',
    async result => {
      let resolve!: (value: unknown) => void;
      let reject!: (error: unknown) => void;
      mockRestore.mockImplementationOnce(
        () =>
          new Promise((resolvePromise, rejectPromise) => {
            resolve = resolvePromise;
            reject = rejectPromise;
          }),
      );
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <BayaanAuthProvider>
            <Text>child</Text>
          </BayaanAuthProvider>,
        );
      });
      await act(async () => {
        useBayaanAuthStore.getState().setSignedOut();
        const attempt = useBayaanAuthStore.getState().setSigningIn();
        useBayaanAuthStore
          .getState()
          .setAuthenticated({accountId: 'account-B'}, attempt);
        if (result === 'error') reject(new Error('old restore failed'));
        else
          resolve(
            result === 'empty' ? null : {profile: {accountId: 'account-A'}},
          );
      });
      expect(useBayaanAuthStore.getState()).toMatchObject({
        status: 'authenticated',
        profile: {accountId: 'account-B'},
        errorCode: null,
      });
      await act(async () => tree.unmount());
    },
  );

  it.each(['session', 'empty', 'error'])(
    'ignores prior-mount restore %s after the remounted provider restores B',
    async result => {
      let resolve!: (value: unknown) => void;
      let reject!: (error: unknown) => void;
      mockRestore
        .mockImplementationOnce(
          () =>
            new Promise((resolvePromise, rejectPromise) => {
              resolve = resolvePromise;
              reject = rejectPromise;
            }),
        )
        .mockResolvedValueOnce({profile: {accountId: 'account-B'}});
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(<BayaanAuthProvider>{null}</BayaanAuthProvider>);
      });
      const oldAttempt = useBayaanAuthStore.getState().authAttempt;
      await act(async () => tree.unmount());
      await act(async () => {
        tree = renderer.create(<BayaanAuthProvider>{null}</BayaanAuthProvider>);
      });
      expect(useBayaanAuthStore.getState().authAttempt).toBeGreaterThan(
        oldAttempt,
      );
      await act(async () => {
        if (result === 'error') reject(new Error('old restore failed'));
        else
          resolve(
            result === 'empty' ? null : {profile: {accountId: 'account-A'}},
          );
      });
      expect(useBayaanAuthStore.getState()).toMatchObject({
        status: 'authenticated',
        profile: {accountId: 'account-B'},
        errorCode: null,
      });
      expect(mockRestore).toHaveBeenCalledTimes(2);
      await act(async () => tree.unmount());
    },
  );

  it('does not resurrect a signed-out profile from a delayed startup restore', async () => {
    let resolve!: (value: unknown) => void;
    mockRestore.mockImplementationOnce(
      () =>
        new Promise(resolvePromise => {
          resolve = resolvePromise;
        }),
    );
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <BayaanAuthProvider>
          <Text>child</Text>
        </BayaanAuthProvider>,
      );
    });
    await act(async () => {
      useBayaanAuthStore.getState().setSignedOut();
      resolve({profile: {accountId: 'account-A'}});
    });
    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'signed_out',
      profile: null,
    });
    await act(async () => tree.unmount());
  });

  it('does not treat a locked Keychain as guest scope and retries on foreground', async () => {
    let foreground!: (state: AppStateStatus) => void;
    const subscription = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, callback) => {
        foreground = callback;
        return {remove: jest.fn()};
      });
    mockRestore
      .mockRejectedValueOnce(new Error('Keychain unavailable'))
      .mockResolvedValueOnce({profile: {accountId: 'account-A'}});
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BayaanAuthProvider>{null}</BayaanAuthProvider>);
    });
    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'initializing',
      profile: null,
    });
    await act(async () => foreground('active'));
    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      profile: {accountId: 'account-A'},
    });
    expect(mockRestore).toHaveBeenCalledTimes(2);
    await act(async () => tree.unmount());
    subscription.mockRestore();
  });

  it('installs the unexpired local account before revalidation and clears it on revocation', async () => {
    let release!: (value: unknown) => void;
    mockRestore.mockImplementationOnce(onStored => {
      onStored({profile: {accountId: 'account-A'}});
      return new Promise(resolve => {
        release = resolve;
      });
    });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BayaanAuthProvider>{null}</BayaanAuthProvider>);
    });
    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      profile: {accountId: 'account-A'},
    });
    await act(async () => release(null));
    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'signed_out',
      profile: null,
    });
    await act(async () => tree.unmount());
  });
});
