import type {BayaanAuthProfile, BayaanOpaqueSession} from '@/types/bayaan-auth';

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

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
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
  constructor(private readonly apiUrl: string) {}

  async startAuth(): Promise<StartAuthResponse> {
    const response = await fetch(joinUrl(this.apiUrl, '/v1/qf/auth/start'), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
    });
    const body = await parseJson(response);

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
    const response = await fetch(joinUrl(this.apiUrl, '/v1/qf/auth/complete'), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({handoff, state}),
    });
    const body = await parseJson(response);

    if (!response.ok) {
      throw new BayaanBffError(
        response.status,
        response.status === 401 ? 'handoff_invalid' : 'complete_failed',
      );
    }

    if (
      !isObject(body) ||
      typeof body.sessionToken !== 'string' ||
      typeof body.expiresAt !== 'string' ||
      !('profile' in body)
    ) {
      throw new BayaanBffError(response.status, 'invalid_complete_response');
    }

    return {
      token: body.sessionToken,
      expiresAt: Date.parse(body.expiresAt),
      profile: parseProfile(body.profile),
    };
  }

  async getSession(token: string): Promise<Omit<BayaanOpaqueSession, 'token'>> {
    const response = await fetch(joinUrl(this.apiUrl, '/v1/qf/auth/session'), {
      headers: {Authorization: `Bearer ${token}`},
    });
    const body = await parseJson(response);

    if (!response.ok) {
      throw new BayaanBffError(
        response.status,
        response.status === 401 ? 'session_revoked' : 'session_failed',
      );
    }

    if (
      !isObject(body) ||
      typeof body.expiresAt !== 'string' ||
      !('profile' in body)
    ) {
      throw new BayaanBffError(response.status, 'invalid_session_response');
    }

    return {
      expiresAt: Date.parse(body.expiresAt),
      profile: parseProfile(body.profile),
    };
  }

  async logout(token: string): Promise<void> {
    const response = await fetch(joinUrl(this.apiUrl, '/v1/qf/auth/logout'), {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`},
    });

    if (!response.ok && response.status !== 401) {
      throw new BayaanBffError(response.status, 'logout_failed');
    }
  }
}
