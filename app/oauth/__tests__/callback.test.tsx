const mockHandleCallbackUrl = jest.fn();
const mockRestore = jest.fn();
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
    restore: () => mockRestore(),
    handleCallbackUrl: (...args: unknown[]) => mockHandleCallbackUrl(...args),
  },
}));

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import OAuthCallbackScreen from '../callback';
import {BayaanAuthProvider} from '@/providers/BayaanAuthProvider';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';

beforeEach(() => {
  mockRestore.mockReset();
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

  it('leaves a signed-in user untouched when a callback fails', async () => {
    useBayaanAuthStore.getState().setAuthenticated({accountId: 'account-1'});
    mockUseLinkingURL.mockReturnValue(
      'bayaan://oauth/callback?handoff=forged&state=attacker-state',
    );
    const {BayaanAuthError} = jest.requireMock(
      '@/services/auth/bayaanAuthService',
    );
    mockHandleCallbackUrl.mockRejectedValueOnce(
      new BayaanAuthError('state_mismatch', 'Sign-in state mismatch'),
    );

    await act(async () => {
      renderer.create(<OAuthCallbackScreen />);
      await Promise.resolve();
    });

    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      profile: {accountId: 'account-1'},
      errorCode: null,
    });
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/(d.settings)');
  });

  it('reports a failed callback when not signed in', async () => {
    mockUseLinkingURL.mockReturnValue(
      'bayaan://oauth/callback?handoff=forged&state=attacker-state',
    );
    const {BayaanAuthError} = jest.requireMock(
      '@/services/auth/bayaanAuthService',
    );
    mockHandleCallbackUrl.mockRejectedValueOnce(
      new BayaanAuthError('state_mismatch', 'Sign-in state mismatch'),
    );

    await act(async () => {
      renderer.create(<OAuthCallbackScreen />);
      await Promise.resolve();
    });

    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'error',
      errorCode: 'state_mismatch',
    });
  });

  it.each(['success', 'error'])(
    'ignores obsolete callback %s after shared ownership changes',
    async result => {
      let resolve!: (value: unknown) => void;
      let reject!: (error: unknown) => void;
      mockHandleCallbackUrl.mockImplementationOnce(
        () =>
          new Promise((resolvePromise, rejectPromise) => {
            resolve = resolvePromise;
            reject = rejectPromise;
          }),
      );
      mockUseLinkingURL.mockReturnValue('old-callback');
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(<OAuthCallbackScreen />);
      });
      await act(async () => {
        useBayaanAuthStore.getState().setSignedOut();
        const attempt = useBayaanAuthStore.getState().setSigningIn();
        useBayaanAuthStore
          .getState()
          .setAuthenticated({accountId: 'account-B'}, attempt);
        if (result === 'success') resolve({profile: {accountId: 'account-A'}});
        else reject(new Error('old callback failed'));
      });
      expect(useBayaanAuthStore.getState()).toMatchObject({
        status: 'authenticated',
        profile: {accountId: 'account-B'},
        errorCode: null,
      });
      expect(mockReplace).not.toHaveBeenCalled();
      await act(async () => tree.unmount());
    },
  );

  it('lets a cold-start callback supersede a pending provider restore', async () => {
    let resolveRestore!: (value: unknown) => void;
    mockRestore.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveRestore = resolve;
        }),
    );
    let provider!: renderer.ReactTestRenderer;
    let callback!: renderer.ReactTestRenderer;
    await act(async () => {
      provider = renderer.create(
        <BayaanAuthProvider>{null}</BayaanAuthProvider>,
      );
    });
    const restoreAttempt = useBayaanAuthStore.getState().authAttempt;
    mockUseLinkingURL.mockReturnValue('cold-callback');
    await act(async () => {
      callback = renderer.create(<OAuthCallbackScreen />);
    });
    expect(useBayaanAuthStore.getState().authAttempt).toBeGreaterThan(
      restoreAttempt,
    );
    await act(async () => {
      resolveRestore({profile: {accountId: 'old-account'}});
    });
    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      profile: {accountId: 'account-1'},
      errorCode: null,
    });
    await act(async () => {
      callback.unmount();
      provider.unmount();
    });
  });

  it('keeps cold-start callback ownership when child effects run before the provider', async () => {
    mockUseLinkingURL.mockReturnValue('cold-callback');
    mockRestore.mockResolvedValueOnce(null);
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <BayaanAuthProvider>
          <OAuthCallbackScreen />
        </BayaanAuthProvider>,
      );
    });
    expect(mockRestore).not.toHaveBeenCalled();
    expect(useBayaanAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      profile: {accountId: 'account-1'},
    });
    await act(async () => tree.unmount());
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
