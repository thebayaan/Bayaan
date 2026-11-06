// @ai-generated
import {BayaanSettingsApiError} from '@/services/settings/bayaanSettingsApiClient';
import {BayaanSyncApiError} from './bayaanSyncApiClient';

/**
 * Shared error handling for the App State syncs that run inside the
 * annotation lifecycle (highlights, library, installed content).
 */

/**
 * A remote failure as the error the lifecycle already knows how to retry, or
 * a revoked session.
 */
export function appStateLifecycleError(
  error: BayaanSettingsApiError,
): BayaanSyncApiError {
  if (error.status === 401) {
    return new BayaanSyncApiError('session_revoked', 401);
  }
  if (error.status === 429) {
    return new BayaanSyncApiError('rate_limited', 429, error.retryAfterMs);
  }
  return new BayaanSyncApiError(
    'service_unavailable',
    error.status,
    error.retryAfterMs,
  );
}

/** QF's document changed since it was read; the next round merges it. */
export function isAppStateConflict(error: unknown): boolean {
  return (
    error instanceof BayaanSettingsApiError &&
    [409, 412, 428].includes(error.status)
  );
}
