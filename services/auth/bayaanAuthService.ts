import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import branding from '@/config/branding';
import {bayaanAuthConfig} from '@/config/bayaanAuth';
import type {BayaanOpaqueSession} from '@/types/bayaan-auth';
import {
  BayaanBffClient,
  BayaanBffError,
  parseExpiresAt,
} from './bayaanBffClient';
import {
  clearBayaanSession,
  clearPendingBayaanAuthState,
  getBayaanSession,
  getPendingBayaanAuthState,
  saveBayaanSession,
  savePendingBayaanAuthState,
  type PendingBayaanAuthState,
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
  openAuthSessionAsync?: (url: string, redirectUrl: string) => Promise<unknown>;
  now?: () => number;
  urlScheme?: string;
}

function parseCallback(url: string, scheme: string): URL {
  let callback: URL;
  try {
    callback = new URL(url);
  } catch {
    throw new BayaanAuthError('malformed_callback', 'Invalid auth callback');
  }
  if (
    callback.hash ||
    [
      'access_token',
      'refresh_token',
      'id_token',
      'code',
      'deviceVerifier',
    ].some(key => callback.searchParams.has(key))
  ) {
    throw new BayaanAuthError(
      'forbidden_callback_artifact',
      'Unsafe auth callback',
    );
  }
  if (
    callback.protocol !== `${scheme}:` ||
    callback.hostname !== 'oauth' ||
    callback.pathname !== '/callback'
  ) {
    throw new BayaanAuthError('malformed_callback', 'Invalid auth callback');
  }
  return callback;
}

export function createBayaanAuthService(
  options: BayaanAuthServiceOptions = {},
) {
  const apiUrl = options.apiUrl ?? bayaanAuthConfig.apiUrl;
  const enabled = options.enabled ?? Boolean(apiUrl);
  const client = options.client ?? new BayaanBffClient(apiUrl);
  const openBrowser =
    options.openAuthSessionAsync ?? WebBrowser.openAuthSessionAsync;
  const now = options.now ?? Date.now;
  const scheme = options.urlScheme ?? branding.urlScheme;
  // One epoch invalidates every asynchronous owner; one queue serializes ALL
  // SecureStore access (including reads that may delete invalid storage).
  let epoch = 0;
  let storageQueue: Promise<unknown> = Promise.resolve();
  let signInPromise: Promise<BayaanOpaqueSession> | null = null;
  let logoutPromise: Promise<void> | null = null;
  // undefined means only the initial cold-start proof may be read from disk.
  // Once consumed/cancelled, null remains authoritative even if deletion fails.
  let pending: PendingBayaanAuthState | null | undefined;
  let exchange: {
    state: string;
    epoch: number;
    promise: Promise<BayaanOpaqueSession>;
  } | null = null;

  function storage<T>(task: () => Promise<T>): Promise<T> {
    const result = storageQueue.then(task, task);
    storageQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  function assertCurrent(owner: number): void {
    if (owner !== epoch || logoutPromise) {
      throw new BayaanAuthError('access_denied', 'Sign-in was cancelled');
    }
  }
  function authError(error: unknown): BayaanAuthError {
    if (error instanceof BayaanAuthError) return error;
    return new BayaanAuthError(
      error instanceof BayaanBffError && error.code === 'handoff_invalid'
        ? 'handoff_invalid'
        : 'network_error',
      'Sign-in failed',
    );
  }
  // A backend exchange may finish after cancellation, before it ever reaches
  // SecureStore. Revoke that token too, not just a token found during logout.
  async function exchangeSession(
    handoff: string,
    proof: PendingBayaanAuthState,
    owner: number,
  ): Promise<BayaanOpaqueSession> {
    let session: BayaanOpaqueSession | undefined;
    let saved = false;
    try {
      await storage(async () => {
        assertCurrent(owner);
        await clearPendingBayaanAuthState();
        assertCurrent(owner);
      });
      session = await client.completeAuth(
        handoff,
        proof.state,
        proof.deviceVerifier,
      );
      assertCurrent(owner);
      await storage(async () => {
        assertCurrent(owner);
        await saveBayaanSession(session!);
        saved = true;
        assertCurrent(owner);
      });
      assertCurrent(owner);
      return session;
    } catch (error) {
      if (session && !saved && owner !== epoch)
        await client.logout(session.token).catch(() => undefined);
      // Do not clear an existing authenticated session for an invalid handoff.
      throw authError(error);
    }
  }

  const service = {
    signIn(): Promise<BayaanOpaqueSession> {
      if (logoutPromise)
        return Promise.reject(
          new BayaanAuthError('access_denied', 'Sign-in was cancelled'),
        );
      if (signInPromise) return signInPromise;
      const owner = ++epoch;
      pending = null;
      exchange = null;
      const promise = Promise.resolve().then(async () => {
        try {
          if (!enabled)
            throw new BayaanAuthError('disabled', 'QF sign-in is unavailable');
          const bytes = await Crypto.getRandomBytesAsync(32);
          const deviceVerifier = Array.from(bytes, byte =>
            byte.toString(16).padStart(2, '0'),
          ).join('');
          const challenge = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            deviceVerifier,
          );
          const start = await client.startAuth(challenge);
          assertCurrent(owner);
          const expiresAt = parseExpiresAt(start.expiresAt);
          if (expiresAt === undefined)
            throw new BayaanAuthError('network_error', 'Invalid auth response');
          await storage(async () => {
            assertCurrent(owner);
            pending = {state: start.state, deviceVerifier, expiresAt};
            await savePendingBayaanAuthState(pending);
            assertCurrent(owner);
          });
          const result = await openBrowser(
            start.authorizationUrl,
            `${scheme}://oauth/callback`,
          );
          assertCurrent(owner);
          // Android can dismiss while the router's matching exchange is active.
          const delivered = exchange as typeof exchange;
          if (delivered?.state === start.state && delivered.epoch === owner)
            return await delivered.promise;
          if (
            result &&
            typeof result === 'object' &&
            'type' in result &&
            result.type === 'success' &&
            'url' in result &&
            typeof result.url === 'string'
          ) {
            return await service.handleCallbackUrl(result.url);
          }
          const cancelled =
            result &&
            typeof result === 'object' &&
            'type' in result &&
            (result.type === 'cancel' || result.type === 'dismiss');
          throw new BayaanAuthError(
            cancelled ? 'access_denied' : 'network_error',
            cancelled ? 'Sign-in was cancelled' : 'Sign-in failed',
          );
        } catch (error) {
          if (owner === epoch) {
            pending = null;
            exchange = null;
            ++epoch; // Revoke BEFORE a possibly failing/held storage cleanup.
            await storage(clearPendingBayaanAuthState);
          }
          throw authError(error);
        } finally {
          if (signInPromise === promise) signInPromise = null;
        }
      });
      signInPromise = promise;
      return promise;
    },

    async handleCallbackUrl(
      url: string,
      onAccepted?: () => void,
    ): Promise<BayaanOpaqueSession> {
      if (!enabled)
        throw new BayaanAuthError('disabled', 'QF sign-in is unavailable');
      const owner = epoch;
      assertCurrent(owner);
      const callback = parseCallback(url, scheme);
      const state = callback.searchParams.get('state');
      if (!state)
        throw new BayaanAuthError(
          'malformed_callback',
          'Invalid auth callback',
        );
      // Only preparation is queued; returning a wrapper avoids joining network
      // exchange inside the storage queue. Dedupe is by state, never by URL.
      const prepared = await storage(async () => {
        if (exchange?.state === state && exchange.epoch === epoch)
          return exchange;
        assertCurrent(owner);
        if (pending === undefined) {
          const stored = await getPendingBayaanAuthState();
          assertCurrent(owner);
          pending = stored;
        }
        if (!pending)
          throw new BayaanAuthError('missing_state', 'Missing sign-in state');
        if (pending.state !== state)
          throw new BayaanAuthError('state_mismatch', 'Sign-in state mismatch');
        const proof = pending;
        pending = null; // Retire matched proof before any await, even on failure.
        const callbackOwner = signInPromise ? owner : ++epoch;
        onAccepted?.();
        const complete = async () => {
          if (
            proof.expiresAt <= now() ||
            callback.searchParams.has('error') ||
            !callback.searchParams.get('handoff')
          ) {
            await storage(clearPendingBayaanAuthState);
            assertCurrent(callbackOwner);
            if (proof.expiresAt <= now())
              throw new BayaanAuthError(
                'expired_state',
                'Sign-in state expired',
              );
            const denied =
              callback.searchParams.get('error') === 'access_denied';
            throw new BayaanAuthError(
              callback.searchParams.has('error')
                ? denied
                  ? 'access_denied'
                  : 'oauth_failed'
                : 'malformed_callback',
              denied ? 'Sign-in was cancelled' : 'Sign-in failed',
            );
          }
          return exchangeSession(
            callback.searchParams.get('handoff')!,
            proof,
            callbackOwner,
          );
        };
        // Start after the preparation queue entry has settled.
        exchange = {
          state,
          epoch: callbackOwner,
          promise: Promise.resolve().then(complete),
        };
        return exchange;
      });
      const session = await prepared.promise;
      assertCurrent(prepared.epoch);
      return session;
    },

    async restore(
      onStored?: (session: BayaanOpaqueSession) => void,
    ): Promise<BayaanOpaqueSession | null> {
      if (!enabled || logoutPromise || signInPromise || exchange) return null;
      const owner = ++epoch;
      const current = () => owner === epoch && !logoutPromise;
      const stored = await storage(() =>
        current() ? getBayaanSession() : Promise.resolve(null),
      );
      if (!stored || !current()) return null;
      onStored?.(stored); // UI can install this unexpired account without network.
      try {
        const fresh = await client.getSession(stored.token);
        if (!current()) return null;
        const session = {...fresh, token: stored.token};
        await storage(async () => {
          if (current()) await saveBayaanSession(session);
        });
        // A matched cold-start callback queued behind a held save supersedes
        // this restore before either caller may publish its UI result.
        await storageQueue;
        return current() ? session : null;
      } catch (error) {
        if (!current()) return null;
        if (
          error instanceof BayaanBffError &&
          error.code === 'session_revoked'
        ) {
          await storage(async () => {
            if (current()) await clearBayaanSession();
          });
          return null;
        }
        return current() && stored.expiresAt > now() ? stored : null;
      }
    },

    logout(): Promise<void> {
      if (logoutPromise) return logoutPromise;
      ++epoch;
      pending = null;
      signInPromise = null; // Never wait for a browser to close.
      const activeExchange = exchange;
      exchange = null;
      const promise = Promise.resolve().then(async () => {
        let firstError: unknown;
        const attempt = async (task: () => Promise<unknown>) => {
          try {
            await task();
          } catch (error) {
            firstError ??= error;
          }
        };
        try {
          await attempt(() => storage(clearPendingBayaanAuthState));
          // Cancellation makes the exchange discard/revoke its result. Drain
          // it even when pending deletion failed, before final session cleanup.
          await activeExchange?.promise.catch(() => undefined);
          await attempt(() =>
            storage(async () => {
              const stored = await getBayaanSession();
              if (stored) await client.logout(stored.token);
            }),
          );
          await attempt(() => storage(clearBayaanSession));
          await attempt(() => storage(clearPendingBayaanAuthState));
          if (firstError) throw firstError;
        } finally {
          if (logoutPromise === promise) logoutPromise = null;
        }
      });
      logoutPromise = promise;
      return promise;
    },
  };
  return service;
}

export const bayaanAuthService = createBayaanAuthService({
  apiUrl: bayaanAuthConfig.apiUrl,
  enabled: bayaanAuthConfig.qfSyncEnabled,
});
