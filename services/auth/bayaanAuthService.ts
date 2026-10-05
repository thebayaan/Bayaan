import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
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
  'deviceVerifier',
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
  openAuthSessionAsync?: (url: string, redirectUrl: string) => Promise<unknown>;
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
  const openAuthSessionAsync =
    options.openAuthSessionAsync ?? WebBrowser.openAuthSessionAsync;
  const now = options.now ?? Date.now;
  let generation = 0;
  let loggingOut = false;
  let logoutPromise: Promise<void> | null = null;
  let signInPromise: Promise<BayaanOpaqueSession> | null = null;
  let signInOwner: object | null = null;
  let lastCallback: {
    key: string;
    state: string | null;
    generation: number;
    promise: Promise<BayaanOpaqueSession>;
  } | null = null;
  const callbacksInFlight = new Map<
    string,
    {
      state: string | null;
      generation: number;
      promise: Promise<BayaanOpaqueSession>;
    }
  >();
  let callbackQueue: Promise<unknown> = Promise.resolve();
  let pendingStorageQueue: Promise<unknown> = Promise.resolve();
  let sessionStorageQueue: Promise<unknown> = Promise.resolve();
  // Callback delivery supersedes startup restore even without a local signIn.
  // It must not advance the login generation: router/browser consumers share it.
  let restoreRevision = 0;
  let acceptUnknownPending = true;
  let pendingAttempt: {state: string; generation: number} | null = null;
  // Local revocations are not unknown cold-start proofs, even when a failed
  // delete leaves bytes behind and a later login replaces pendingAttempt.
  const revokedPendingStates = new Set<string>();

  // Serialize pending-state reads/deletes too: an old cleanup must not erase
  // a newer verifier, and logout must drain writes without waiting on a browser.
  function pendingStorage<T>(task: () => Promise<T>): Promise<T> {
    const result = pendingStorageQueue.then(task, task);
    pendingStorageQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  // Reads can clear invalid/expired storage too. Queue them with all service
  // writes so a started restore mutation drains before callback save/logout.
  // These tasks never wait on callbackQueue or pendingStorageQueue.
  function sessionStorage<T>(task: () => Promise<T>): Promise<T> {
    const result = sessionStorageQueue.then(task, task);
    sessionStorageQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  function assertGeneration(expected: number): void {
    if (loggingOut || expected !== generation) {
      throw new BayaanAuthError('access_denied', 'Sign-in was cancelled');
    }
  }

  const service = {
    signIn(): Promise<BayaanOpaqueSession> {
      if (loggingOut) {
        return Promise.reject(
          new BayaanAuthError('access_denied', 'Sign-in was cancelled'),
        );
      }
      // One attempt owns the stored verifier, including while /start is pending.
      if (signInPromise) return signInPromise;
      if (pendingAttempt) revokedPendingStates.add(pendingAttempt.state);
      acceptUnknownPending = false;
      const attemptGeneration = ++generation;
      restoreRevision += 1;
      const owner = {};
      signInOwner = owner;
      lastCallback = null;
      // Defer even immediate failures until the promise/owner are installed.
      signInPromise = Promise.resolve().then(async () => {
        try {
          if (!enabled) {
            throw new BayaanAuthError('disabled', 'QF sign-in is unavailable');
          }
          const bytes = await Crypto.getRandomBytesAsync(32);
          const deviceVerifier = Array.from(bytes, byte =>
            byte.toString(16).padStart(2, '0'),
          ).join('');
          const deviceChallenge = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            deviceVerifier,
          );
          const start = await client.startAuth(deviceChallenge);
          assertGeneration(attemptGeneration);
          pendingAttempt = {state: start.state, generation: attemptGeneration};
          await pendingStorage(async () => {
            assertGeneration(attemptGeneration);
            await savePendingBayaanAuthState({
              state: start.state,
              deviceVerifier,
              expiresAt: parseExpiresAt(start.expiresAt),
            });
            assertGeneration(attemptGeneration);
            // A successfully persisted new proof now owns this state. Never
            // remove a tombstone for an ambiguous or logout-cancelled write.
            revokedPendingStates.delete(start.state);
          });
          assertGeneration(attemptGeneration);
          const result = await openAuthSessionAsync(
            start.authorizationUrl,
            'bayaan://oauth/callback',
          );
          if (attemptGeneration !== generation) {
            throw new BayaanAuthError('access_denied', 'Sign-in was cancelled');
          }
          // Android may report dismiss/cancel while the deep-link exchange is
          // in flight. Join it rather than erasing its state or failing the UI.
          const delivered =
            [...callbacksInFlight.values()].find(
              item =>
                item.state === start.state &&
                item.generation === attemptGeneration,
            ) ??
            (lastCallback as {
              state: string | null;
              generation: number;
              promise: Promise<BayaanOpaqueSession>;
            } | null);
          if (
            delivered?.state === start.state &&
            delivered.generation === attemptGeneration
          ) {
            const session = await delivered.promise;
            assertGeneration(attemptGeneration);
            return session;
          }
          if (
            result &&
            typeof result === 'object' &&
            'type' in result &&
            result.type === 'success' &&
            'url' in result &&
            typeof result.url === 'string'
          ) {
            const session = await service.handleCallbackUrl(result.url);
            assertGeneration(attemptGeneration);
            return session;
          }
          throw new BayaanAuthError(
            getBrowserResultType(result) ? 'access_denied' : 'network_error',
            getBrowserResultType(result)
              ? 'Sign-in was cancelled'
              : 'Sign-in failed',
          );
        } catch (error) {
          if (attemptGeneration === generation) {
            if (pendingAttempt?.generation === attemptGeneration) {
              revokedPendingStates.add(pendingAttempt.state);
            }
            // Revoke before cleanup yields: a queued or newly delivered link
            // must never redeem proof belonging to this terminal failure.
            const cleanupGeneration = ++generation;
            lastCallback = null;
            await pendingStorage(async () => {
              if (cleanupGeneration === generation) {
                await clearPendingBayaanAuthState();
              }
            });
          }
          if (error instanceof BayaanAuthError) throw error;
          throw new BayaanAuthError('network_error', 'Sign-in failed');
        } finally {
          if (signInOwner === owner) {
            signInPromise = null;
            signInOwner = null;
          }
        }
      });
      return signInPromise;
    },

    async handleCallbackUrl(url: string): Promise<BayaanOpaqueSession> {
      if (loggingOut) {
        throw new BayaanAuthError('access_denied', 'Sign-in was cancelled');
      }
      // Install the shared promise synchronously, before SecureStore yields.
      // Keep only the most recent result, so duplicate router/browser deliveries
      // cannot exchange twice or change authenticated UI back to an error.
      const callback = parseCallback(url);
      assertNoForbiddenArtifacts(callback);
      assertExactCallbackRoute(callback);
      const key = JSON.stringify(
        ['state', 'handoff', 'error'].map(name =>
          callback.searchParams.get(name),
        ),
      );
      // Invalidate restores synchronously, before pending storage or exchange
      // yields. Even a cold-start router callback goes through this gate.
      restoreRevision += 1;
      const deliveredGeneration = generation;
      const existing =
        lastCallback?.key === key &&
        lastCallback.generation === deliveredGeneration
          ? lastCallback
          : callbacksInFlight.get(key);
      if (existing?.generation === deliveredGeneration) {
        const session = await existing.promise;
        assertGeneration(deliveredGeneration);
        return session;
      }
      // Serialize distinct callbacks as well. A forged link interleaved with
      // two real deliveries must neither clear state nor start two exchanges.
      if (callbacksInFlight.size >= 8) {
        throw new BayaanAuthError(
          'malformed_callback',
          'Invalid auth callback',
        );
      }
      const promise = callbackQueue.then(() => {
        assertGeneration(deliveredGeneration);
        return service.completeCallback(url);
      });
      callbackQueue = promise.then(
        () => undefined,
        () => undefined,
      );
      callbacksInFlight.set(key, {
        state: callback.searchParams.get('state'),
        generation: deliveredGeneration,
        promise,
      });
      try {
        const session = await promise;
        assertGeneration(deliveredGeneration);
        lastCallback = {
          key,
          state: callback.searchParams.get('state'),
          generation: deliveredGeneration,
          promise,
        };
        return session;
      } finally {
        if (callbacksInFlight.get(key)?.promise === promise) {
          callbacksInFlight.delete(key);
        }
      }
    },

    async completeCallback(url: string): Promise<BayaanOpaqueSession> {
      const attemptGeneration = generation;
      const callback = parseCallback(url);
      let pending = await pendingStorage(getPendingBayaanAuthState);
      // Only a callback carrying this attempt's state (or arriving after the
      // attempt expired) may end it. Anything else is an unrelated or forged
      // link and must not cancel a sign-in that is still in progress.
      let endsPendingAttempt = false;
      const pendingState = pending?.state;

      try {
        assertGeneration(attemptGeneration);
        assertNoForbiddenArtifacts(callback);
        assertExactCallbackRoute(callback);

        if (!pending) {
          throw new BayaanAuthError('missing_state', 'Missing sign-in state');
        }

        // In-process attempts remain bound to their generation even if a
        // cancelled write or failed delete left bytes behind. Unknown stored
        // attempts are still accepted on legitimate cold-start callbacks.
        if (revokedPendingStates.has(pending.state)) {
          throw new BayaanAuthError('access_denied', 'Sign-in was cancelled');
        }
        if (pendingAttempt?.state === pending.state) {
          assertGeneration(pendingAttempt.generation);
        } else {
          // After a local login/logout, a leftover is never an unknown cold-start
          // proof in this process. Only a freshly persisted local login may own it.
          if (!acceptUnknownPending) {
            throw new BayaanAuthError('access_denied', 'Sign-in was cancelled');
          }
          pendingAttempt = {
            state: pending.state,
            generation: attemptGeneration,
          };
        }

        if (pending.expiresAt <= now()) {
          endsPendingAttempt = true;
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
        endsPendingAttempt = true;

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

        const deviceVerifier = pending.deviceVerifier;
        await pendingStorage(clearPendingBayaanAuthState);
        pending = null;
        assertGeneration(attemptGeneration);

        const session = await client.completeAuth(
          handoff,
          callbackState,
          deviceVerifier,
        );
        assertGeneration(attemptGeneration);
        await sessionStorage(async () => {
          assertGeneration(attemptGeneration);
          await saveBayaanSession(session);
        });
        // Logout drains this save so it can revoke and clear the stored token,
        // but no callback consumer may receive that now-cancelled session.
        assertGeneration(attemptGeneration);
        return session;
      } catch (error) {
        if (endsPendingAttempt && attemptGeneration === generation) {
          // Cold-start failures have no enclosing signIn catch. Tombstone before
          // cleanup yields, including when consumption/deletion itself failed.
          if (pendingState) revokedPendingStates.add(pendingState);
          await pendingStorage(async () => {
            if (attemptGeneration === generation) {
              await clearPendingBayaanAuthState();
            }
          });
        }
        if (pending) {
          pending = null;
        }
        if (
          error instanceof BayaanBffError &&
          error.code === 'handoff_invalid'
        ) {
          await sessionStorage(async () => {
            if (!loggingOut && attemptGeneration === generation) {
              await clearBayaanSession();
            }
          });
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
      if (loggingOut || signInPromise || callbacksInFlight.size) return null;
      const attemptGeneration = generation;
      const revision = ++restoreRevision;
      const isCurrent = () =>
        !loggingOut &&
        attemptGeneration === generation &&
        revision === restoreRevision;
      const stored = await sessionStorage(() =>
        isCurrent() ? getBayaanSession() : Promise.resolve(null),
      );
      if (!stored || !isCurrent()) return null;

      try {
        const fresh = await client.getSession(stored.token);
        const session = {...fresh, token: stored.token};
        await sessionStorage(async () => {
          if (isCurrent()) await saveBayaanSession(session);
        });
        return isCurrent() ? session : null;
      } catch (error) {
        if (!isCurrent()) return null;
        if (
          error instanceof BayaanBffError &&
          error.code === 'session_revoked'
        ) {
          await sessionStorage(async () => {
            if (isCurrent()) await clearBayaanSession();
          });
          return null;
        }

        // Offline fallback may keep only the still-current, unexpired account.
        // A superseded restore must not resurrect it, even after a held write.
        return isCurrent() && stored.expiresAt > now() ? stored : null;
      }
    },

    logout(): Promise<void> {
      // Concurrent callers must not release cancellation before cleanup ends.
      if (logoutPromise) return logoutPromise;
      loggingOut = true;
      generation += 1;
      restoreRevision += 1;
      // If discovery fails too, reject unknown leftovers for this service's
      // lifetime. Report the I/O error; a new local signIn can still recover.
      acceptUnknownPending = false;
      if (pendingAttempt) revokedPendingStates.add(pendingAttempt.state);
      signInPromise = null;
      signInOwner = null;
      lastCallback = null;
      logoutPromise = (async () => {
        const errors: unknown[] = [];
        const attempt = async (task: () => Promise<unknown>): Promise<void> => {
          try {
            await task();
          } catch (error) {
            errors.push(error);
          }
        };
        try {
          // Discover prior-process proof behind pending writes and revoke it
          // before deletion. Read failure must not skip either delete or drain.
          await attempt(() =>
            pendingStorage(async () => {
              const pending = await getPendingBayaanAuthState();
              if (pending) revokedPendingStates.add(pending.state);
            }),
          );
          await attempt(() => pendingStorage(clearPendingBayaanAuthState));
          // This queue already absorbs callback rejections. No started callback
          // session save may settle after revocation or the final session clear.
          // Do not join signInPromise: its browser may remain open indefinitely.
          await callbackQueue;
          await sessionStorageQueue;
          lastCallback = null;
          await attempt(() =>
            sessionStorage(async () => {
              const stored = await getBayaanSession();
              if (stored) await client.logout(stored.token);
            }),
          );
          await attempt(() => sessionStorage(clearBayaanSession));
          await attempt(() => pendingStorage(clearPendingBayaanAuthState));
          // Preserve a lone original error; retain all failures in execution
          // order rather than letting final cleanup mask the earlier failure.
          if (errors.length === 1) throw errors[0];
          if (errors.length > 1) {
            throw new AggregateError(errors, 'Sign-out cleanup failed');
          }
        } finally {
          lastCallback = null;
          loggingOut = false;
          logoutPromise = null;
        }
      })();
      return logoutPromise;
    },
  };
  // The exchange implementation is private to the shared callback gate.
  return {
    signIn: service.signIn,
    handleCallbackUrl: service.handleCallbackUrl,
    restore: service.restore,
    logout: service.logout,
  };
}

export const bayaanAuthService = createBayaanAuthService({
  apiUrl: bayaanAuthConfig.apiUrl,
  enabled: bayaanAuthConfig.qfSyncEnabled,
});
