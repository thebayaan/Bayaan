import * as WebBrowser from 'expo-web-browser';
import {bayaanAuthConfig} from '@/config/bayaanAuth';
import type {BayaanOpaqueSession} from '@/types/bayaan-auth';
import {
  BayaanBffClient,
  BayaanBffError,
  parseExpiresAt as parseFiniteExpiresAt,
} from './bayaanBffClient';
import {
  clearBayaanSession,
  clearPendingBayaanAuthState,
  getBayaanSession,
  getPendingBayaanAuthState,
  saveBayaanSession,
  savePendingBayaanAuthState,
} from './bayaanSessionStorage';

export type BayaanAuthErrorCode =
  | 'disabled'
  | 'missing_state'
  | 'expired_state'
  | 'state_mismatch'
  | 'malformed_callback'
  | 'forbidden_callback_artifact'
  | 'access_denied'
  | 'oauth_failed'
  | 'handoff_invalid'
  | 'network_error';

const FORBIDDEN_CALLBACK_PARAMS = new Set([
  'access_token',
  'refresh_token',
  'id_token',
  'code',
]);

function getBrowserResultType(result: unknown): 'cancel' | 'dismiss' | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const type = (result as {type?: unknown}).type;
  return type === 'cancel' || type === 'dismiss' ? type : null;
}

export class BayaanAuthError extends Error {
  constructor(
    public readonly code: BayaanAuthErrorCode,
    message: string,
    _details?: unknown,
  ) {
    super(message);
    this.name = 'BayaanAuthError';
  }
}

interface BayaanAuthServiceOptions {
  apiUrl?: string;
  enabled?: boolean;
  client?: BayaanBffClient;
  openBrowserAsync?: (url: string) => Promise<unknown>;
  now?: () => number;
}

function parseExpiresAt(value: string): number {
  const parsed = parseFiniteExpiresAt(value);
  if (parsed === undefined) {
    throw new BayaanAuthError('network_error', 'Invalid auth response');
  }
  return parsed;
}

function constantTimeEqual(left: string, right: string): boolean {
  const max = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;

  for (let index = 0; index < max; index += 1) {
    if ((left.charCodeAt(index) || 0) !== (right.charCodeAt(index) || 0)) {
      diff += 1;
    }
  }

  return diff === 0;
}

function parseCallback(url: string): URL {
  try {
    return new URL(url);
  } catch {
    throw new BayaanAuthError('malformed_callback', 'Invalid auth callback');
  }
}

function assertNoForbiddenArtifacts(callback: URL): void {
  if (callback.hash) {
    throw new BayaanAuthError(
      'forbidden_callback_artifact',
      'Unsafe auth callback',
    );
  }

  for (const key of callback.searchParams.keys()) {
    if (FORBIDDEN_CALLBACK_PARAMS.has(key)) {
      throw new BayaanAuthError(
        'forbidden_callback_artifact',
        'Unsafe auth callback',
      );
    }
  }
}

function assertExactCallbackRoute(callback: URL): void {
  if (
    callback.protocol !== 'bayaan:' ||
    callback.hostname !== 'oauth' ||
    callback.pathname !== '/callback'
  ) {
    throw new BayaanAuthError('malformed_callback', 'Invalid auth callback');
  }
}

export function createBayaanAuthService(
  options: BayaanAuthServiceOptions = {},
) {
  const apiUrl = options.apiUrl ?? bayaanAuthConfig.apiUrl;
  const enabled = options.enabled ?? Boolean(apiUrl);
  const client = options.client ?? new BayaanBffClient(apiUrl);
  const openBrowserAsync =
    options.openBrowserAsync ?? WebBrowser.openBrowserAsync;
  const now = options.now ?? Date.now;
  let signInAwaitingBrowser = false;
  let successfulCallbackDuringSignIn = false;

  return {
    async signIn(): Promise<void> {
      if (!enabled) {
        throw new BayaanAuthError('disabled', 'QF sign-in is unavailable');
      }

      const start = await client.startAuth();
      await savePendingBayaanAuthState({
        state: start.state,
        expiresAt: parseExpiresAt(start.expiresAt),
      });

      try {
        signInAwaitingBrowser = true;
        const browserResult = await openBrowserAsync(start.authorizationUrl);
        const browserResultType = getBrowserResultType(browserResult);
        if (browserResultType) {
          if (
            browserResultType === 'dismiss' &&
            successfulCallbackDuringSignIn
          ) {
            return;
          }
          throw new BayaanAuthError('access_denied', 'Sign-in was cancelled');
        }
      } catch (error) {
        await clearPendingBayaanAuthState();
        if (error instanceof BayaanAuthError) {
          throw error;
        }
        throw new BayaanAuthError('network_error', 'Sign-in failed');
      } finally {
        signInAwaitingBrowser = false;
        successfulCallbackDuringSignIn = false;
      }
    },

    async handleCallbackUrl(url: string): Promise<BayaanOpaqueSession> {
      const callback = parseCallback(url);
      let pending = await getPendingBayaanAuthState();

      try {
        assertNoForbiddenArtifacts(callback);
        assertExactCallbackRoute(callback);

        if (!pending) {
          throw new BayaanAuthError('missing_state', 'Missing sign-in state');
        }

        if (pending.expiresAt <= now()) {
          throw new BayaanAuthError('expired_state', 'Sign-in state expired');
        }

        const callbackState = callback.searchParams.get('state');
        if (!callbackState) {
          throw new BayaanAuthError(
            'malformed_callback',
            'Invalid auth callback',
          );
        }

        if (!constantTimeEqual(pending.state, callbackState)) {
          throw new BayaanAuthError('state_mismatch', 'Sign-in state mismatch');
        }

        const providerError = callback.searchParams.get('error');
        if (providerError) {
          throw new BayaanAuthError(
            providerError === 'access_denied'
              ? 'access_denied'
              : 'oauth_failed',
            providerError === 'access_denied'
              ? 'Sign-in was cancelled'
              : 'Sign-in failed',
          );
        }

        const handoff = callback.searchParams.get('handoff');
        if (!handoff) {
          throw new BayaanAuthError(
            'malformed_callback',
            'Invalid auth callback',
          );
        }

        await clearPendingBayaanAuthState();
        pending = null;

        const session = await client.completeAuth(handoff, callbackState);
        await saveBayaanSession(session);
        if (signInAwaitingBrowser) {
          successfulCallbackDuringSignIn = true;
        }
        WebBrowser.dismissBrowser();
        return session;
      } catch (error) {
        await clearPendingBayaanAuthState();
        if (pending) {
          pending = null;
        }
        if (
          error instanceof BayaanBffError &&
          error.code === 'handoff_invalid'
        ) {
          await clearBayaanSession();
          throw new BayaanAuthError(
            'handoff_invalid',
            'Invalid or expired sign-in handoff',
          );
        }
        if (error instanceof BayaanAuthError) {
          throw error;
        }
        throw new BayaanAuthError('network_error', 'Sign-in failed');
      }
    },

    async restore(): Promise<BayaanOpaqueSession | null> {
      const stored = await getBayaanSession();
      if (!stored) {
        return null;
      }

      try {
        const fresh = await client.getSession(stored.token);
        const session = {...fresh, token: stored.token};
        await saveBayaanSession(session);
        return session;
      } catch (error) {
        if (
          error instanceof BayaanBffError &&
          error.code === 'session_revoked'
        ) {
          await clearBayaanSession();
        }
        return null;
      }
    },

    async logout(): Promise<void> {
      const stored = await getBayaanSession();
      try {
        if (stored) {
          await client.logout(stored.token);
        }
      } finally {
        await clearBayaanSession();
        await clearPendingBayaanAuthState();
      }
    },
  };
}

export const bayaanAuthService = createBayaanAuthService({
  apiUrl: bayaanAuthConfig.apiUrl,
  enabled: bayaanAuthConfig.qfSyncEnabled,
});
