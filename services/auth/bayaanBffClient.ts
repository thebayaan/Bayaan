import type {BayaanAuthProfile, BayaanOpaqueSession} from '@/types/bayaan-auth';
import {
  BoundedHttpError,
  boundedJsonRequest,
  boundedRequest,
} from '@/services/network/boundedHttp';

const AUTH_TIMEOUT_MS = 8_000;
const AUTH_MAX_RESPONSE_BYTES = 64 * 1024;

interface StartAuthResponse {
  authorizationUrl: string;
  state: string;
  expiresAt: string;
}

function joinUrl(baseUrl: string, path: string) {
  return new URL(path, `${baseUrl.replace(/\/+$/, '')}/`).toString();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseProfile(value: unknown): BayaanAuthProfile {
  if (!isObject(value) || typeof value.accountId !== 'string') {
    throw new Error('Invalid Bayaan auth profile');
  }

  return {
    accountId: value.accountId,
    ...(typeof value.email === 'string' ? {email: value.email} : {}),
    ...(typeof value.name === 'string' ? {name: value.name} : {}),
    ...(typeof value.picture === 'string' ? {picture: value.picture} : {}),
  };
}

export function parseExpiresAt(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class BayaanBffError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message = 'Bayaan auth request failed',
  ) {
    super(message);
    this.name = 'BayaanBffError';
  }
}

export class BayaanBffClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(
    private readonly apiUrl: string,
    options: {fetchImpl?: typeof fetch; timeoutMs?: number} = {},
  ) {
    this.fetchImpl =
      options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? AUTH_TIMEOUT_MS;
  }

  private async jsonRequest(
    path: string,
    init: RequestInit,
    invalidCode: string,
    requestCode: string,
  ): Promise<{response: Response; body: unknown | null}> {
    try {
      return await boundedJsonRequest(
        this.fetchImpl,
        joinUrl(this.apiUrl, path),
        init,
        {
          timeoutMs: this.timeoutMs,
          maxResponseBytes: AUTH_MAX_RESPONSE_BYTES,
        },
      );
    } catch (error) {
      throw new BayaanBffError(
        0,
        error instanceof BoundedHttpError &&
          (error.code === 'response_too_large' || error.code === 'invalid_json')
          ? invalidCode
          : requestCode,
      );
    }
  }

  async startAuth(): Promise<StartAuthResponse> {
    const {response, body} = await this.jsonRequest(
      '/v1/qf/auth/start',
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
      },
      'invalid_start_response',
      'start_failed',
    );

    if (!response.ok) {
      throw new BayaanBffError(response.status, 'start_failed');
    }

    if (
      !isObject(body) ||
      typeof body.authorizationUrl !== 'string' ||
      typeof body.state !== 'string' ||
      typeof body.expiresAt !== 'string'
    ) {
      throw new BayaanBffError(response.status, 'invalid_start_response');
    }

    return {
      authorizationUrl: body.authorizationUrl,
      state: body.state,
      expiresAt: body.expiresAt,
    };
  }

  async completeAuth(
    handoff: string,
    state: string,
  ): Promise<BayaanOpaqueSession> {
    const {response, body} = await this.jsonRequest(
      '/v1/qf/auth/complete',
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({handoff, state}),
      },
      'invalid_complete_response',
      'complete_failed',
    );

    if (!response.ok) {
      throw new BayaanBffError(
        response.status,
        response.status === 401 ? 'handoff_invalid' : 'complete_failed',
      );
    }

    const expiresAt =
      isObject(body) && typeof body.expiresAt === 'string'
        ? parseExpiresAt(body.expiresAt)
        : undefined;
    if (
      !isObject(body) ||
      typeof body.sessionToken !== 'string' ||
      expiresAt === undefined ||
      !('profile' in body)
    ) {
      throw new BayaanBffError(response.status, 'invalid_complete_response');
    }

    return {
      token: body.sessionToken,
      expiresAt,
      profile: parseProfile(body.profile),
    };
  }

  async getSession(token: string): Promise<Omit<BayaanOpaqueSession, 'token'>> {
    const {response, body} = await this.jsonRequest(
      '/v1/qf/auth/session',
      {headers: {Authorization: `Bearer ${token}`}},
      'invalid_session_response',
      'session_failed',
    );

    if (!response.ok) {
      throw new BayaanBffError(
        response.status,
        response.status === 401 ? 'session_revoked' : 'session_failed',
      );
    }

    const expiresAt =
      isObject(body) && typeof body.expiresAt === 'string'
        ? parseExpiresAt(body.expiresAt)
        : undefined;
    if (!isObject(body) || expiresAt === undefined || !('profile' in body)) {
      throw new BayaanBffError(response.status, 'invalid_session_response');
    }

    return {
      expiresAt,
      profile: parseProfile(body.profile),
    };
  }

  async logout(token: string): Promise<void> {
    let response: Response;
    try {
      response = await boundedRequest(
        this.fetchImpl,
        joinUrl(this.apiUrl, '/v1/qf/auth/logout'),
        {
          method: 'POST',
          headers: {Authorization: `Bearer ${token}`},
        },
        this.timeoutMs,
      );
    } catch {
      throw new BayaanBffError(0, 'logout_failed');
    }

    if (!response.ok && response.status !== 401) {
      throw new BayaanBffError(response.status, 'logout_failed');
    }
  }
}
