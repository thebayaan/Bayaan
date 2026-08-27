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
  | 'request_failed';

export class BayaanSyncApiError extends Error {
  constructor(
    public readonly code: BayaanSyncApiErrorCode,
    public readonly status: number,
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
const SYNC_MAX_RESPONSE_BYTES = 1024 * 1024;

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

function mapStatus(status: number): BayaanSyncApiError {
  if (status === 401) return new BayaanSyncApiError('session_revoked', status);
  if (status === 409) return new BayaanSyncApiError('sync_conflict', status);
  if (status === 429) return new BayaanSyncApiError('rate_limited', status);
  if (status >= 500) {
    return new BayaanSyncApiError('service_unavailable', status);
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
      });
    } catch (error) {
      if (
        error instanceof BoundedHttpError &&
        (error.code === 'response_too_large' || error.code === 'invalid_json')
      ) {
        throw new BayaanSyncApiError('invalid_response', 0);
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
      throw mapStatus(response.status);
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
      throw mapStatus(response.status);
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
