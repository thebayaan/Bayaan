import {
  BayaanSyncDecodeError,
  decodeBayaanSyncPullResponse,
  decodeBayaanSyncPushResponse,
  decodeBayaanSyncRequestMutation,
  type BayaanSyncRequestMutation,
  type BayaanSyncPullPage,
  type BayaanSyncPushResult,
} from './bayaanSyncCodec';
import {
  type BoundedFetch,
  BoundedHttpError,
  boundedJsonRequest,
} from '@/services/network/boundedHttp';

export type BayaanSyncApiErrorCode =
  | 'session_revoked'
  | 'sync_conflict'
  | 'rate_limited'
  | 'service_unavailable'
  | 'invalid_response'
  | 'response_too_large'
  | 'request_failed';

export class BayaanSyncApiError extends Error {
  constructor(
    public readonly code: BayaanSyncApiErrorCode,
    public readonly status: number,
    public readonly retryAfterMs?: number,
  ) {
    super('Bayaan Sync request failed');
    this.name = 'BayaanSyncApiError';
  }
}

export interface BayaanSyncPullRequest {
  mutationsSince: number;
  metadataOnly?: boolean;
  limit?: number;
  page?: number;
}

export interface BayaanSyncPushRequest {
  lastMutationAt: number;
  mutations: BayaanSyncRequestMutation[];
}

interface BayaanSyncApiClientOptions {
  apiUrl: string;
  fetchImpl?: BoundedFetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

const SYNC_RESOURCES = ['BOOKMARK', 'NOTE', 'READING_SESSION'] as const;
const SYNC_TIMEOUT_MS = 8_000;
// One supported 200k-character note can require 1.2MB when JSON escapes
// control characters. Admit one such mutation while bounding every response;
// the coordinator halves oversized pull pages and restarts their traversal.
const SYNC_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function expoFetch(input: string, init?: RequestInit): Promise<Response> {
  const module = require('expo/fetch') as {fetch: BoundedFetch};
  return module.fetch(input, init);
}

function syncUrl(apiUrl: string, request: BayaanSyncPullRequest): string {
  const url = new URL('/v1/qf/sync', `${apiUrl.replace(/\/+$/, '')}/`);
  url.searchParams.set('mutationsSince', String(request.mutationsSince));
  url.searchParams.set('resources', SYNC_RESOURCES.join(','));
  if (request.metadataOnly !== undefined) {
    url.searchParams.set('metadataOnly', String(request.metadataOnly));
  }
  if (request.limit !== undefined) {
    url.searchParams.set('limit', String(request.limit));
  }
  if (request.page !== undefined) {
    url.searchParams.set('page', String(request.page));
  }
  return url.toString();
}

function pushUrl(apiUrl: string, lastMutationAt: number): string {
  const url = new URL('/v1/qf/sync', `${apiUrl.replace(/\/+$/, '')}/`);
  url.searchParams.set('lastMutationAt', String(lastMutationAt));
  return url.toString();
}

function isBffPullSizeError(body: unknown): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const envelope = body as Record<string, unknown>;
  if (Object.keys(envelope).some(key => key !== 'error')) return false;
  const error = envelope.error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return false;
  const detail = error as Record<string, unknown>;
  return (
    Object.keys(detail).every(key => key === 'code' || key === 'message') &&
    detail.code === 'QF_SYNC_RESPONSE_TOO_LARGE' &&
    (detail.message === undefined || typeof detail.message === 'string')
  );
}

function mapStatus(response: Response): BayaanSyncApiError {
  const status = response.status;
  const raw = response.headers.get('retry-after');
  const seconds = raw && /^\d+$/.test(raw) ? Number(raw) : NaN;
  const deadline = raw && !Number.isFinite(seconds) ? Date.parse(raw) : NaN;
  const delay = Number.isFinite(seconds)
    ? seconds * 1000
    : deadline - Date.now();
  const retryAfterMs =
    Number.isFinite(delay) && delay >= 0
      ? Math.min(delay, 3_600_000)
      : undefined;
  if (status === 401) return new BayaanSyncApiError('session_revoked', status);
  if (status === 409) return new BayaanSyncApiError('sync_conflict', status);
  if (status === 429)
    return new BayaanSyncApiError('rate_limited', status, retryAfterMs);
  if (status >= 500) {
    return new BayaanSyncApiError('service_unavailable', status, retryAfterMs);
  }
  return new BayaanSyncApiError('request_failed', status);
}

export class BayaanSyncApiClient {
  private readonly fetchImpl: BoundedFetch;

  constructor(private readonly options: BayaanSyncApiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? expoFetch;
  }

  private async request(
    input: string,
    init: RequestInit,
  ): Promise<{response: Response; body: unknown | null}> {
    try {
      return await boundedJsonRequest(this.fetchImpl, input, init, {
        timeoutMs: this.options.timeoutMs ?? SYNC_TIMEOUT_MS,
        maxResponseBytes:
          this.options.maxResponseBytes ?? SYNC_MAX_RESPONSE_BYTES,
        ...(init.method === 'GET' ? {readErrorBodyStatus: 502} : {}),
      });
    } catch (error) {
      if (
        error instanceof BoundedHttpError &&
        error.code === 'response_too_large'
      ) {
        throw new BayaanSyncApiError('response_too_large', 200);
      }
      if (error instanceof BoundedHttpError && error.code === 'invalid_json') {
        throw new BayaanSyncApiError('invalid_response', 200);
      }
      throw new BayaanSyncApiError('service_unavailable', 0);
    }
  }

  async pull(
    opaqueSessionToken: string,
    request: BayaanSyncPullRequest,
  ): Promise<BayaanSyncPullPage> {
    if (!opaqueSessionToken) {
      throw new BayaanSyncApiError('session_revoked', 401);
    }

    const {response, body} = await this.request(
      syncUrl(this.options.apiUrl, request),
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${opaqueSessionToken}`,
        },
      },
    );

    if (!response.ok) {
      if (response.status === 502 && isBffPullSizeError(body)) {
        throw new BayaanSyncApiError('response_too_large', 502);
      }
      throw mapStatus(response);
    }

    try {
      return decodeBayaanSyncPullResponse(body, request);
    } catch (error) {
      if (
        error instanceof BayaanSyncDecodeError ||
        error instanceof SyntaxError
      ) {
        throw new BayaanSyncApiError('invalid_response', response.status);
      }
      throw new BayaanSyncApiError('invalid_response', response.status);
    }
  }

  async push(
    opaqueSessionToken: string,
    request: BayaanSyncPushRequest,
  ): Promise<BayaanSyncPushResult> {
    if (!opaqueSessionToken) {
      throw new BayaanSyncApiError('session_revoked', 401);
    }
    if (
      !Number.isSafeInteger(request.lastMutationAt) ||
      request.lastMutationAt <= 0 ||
      request.mutations.length < 1 ||
      request.mutations.length > 100
    ) {
      throw new BayaanSyncApiError('request_failed', 400);
    }

    let mutations: BayaanSyncRequestMutation[];
    try {
      mutations = request.mutations.map(decodeBayaanSyncRequestMutation);
    } catch {
      throw new BayaanSyncApiError('request_failed', 400);
    }

    const {response, body} = await this.request(
      pushUrl(this.options.apiUrl, request.lastMutationAt),
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${opaqueSessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mutations,
        }),
      },
    );

    if (!response.ok) {
      throw mapStatus(response);
    }

    try {
      const result = decodeBayaanSyncPushResponse(body);
      if (result.lastMutationAt < request.lastMutationAt) {
        throw new BayaanSyncDecodeError();
      }
      return result;
    } catch {
      throw new BayaanSyncApiError('invalid_response', response.status);
    }
  }
}
