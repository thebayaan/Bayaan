import {
  type BoundedFetch,
  BoundedHttpError,
  boundedJsonRequest,
} from '@/services/network/boundedHttp';

const TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 256 * 1024;

export type SettingsDocumentKey =
  | 'appearance'
  | 'mushaf'
  | 'audio'
  | 'adhkar'
  | 'browsing';

export interface PreferenceMutation {
  group: string;
  key: string;
  value: unknown;
}

export interface RemoteSettingsDocument {
  key: SettingsDocumentKey;
  value: Record<string, unknown>;
  etag: string;
  // Newer schemas can be projected for display, never downgraded on write.
  schemaVersion?: number;
  readOnly?: boolean;
}

function expoFetch(input: string, init?: RequestInit): Promise<Response> {
  const module = require('expo/fetch') as {fetch: BoundedFetch};
  return module.fetch(input, init);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function joinUrl(baseUrl: string, path: string) {
  return new URL(path, `${baseUrl.replace(/\/+$/, '')}/`).toString();
}

function serviceCode(body: unknown): string | undefined {
  if (!isObject(body) || !isObject(body.error)) return undefined;
  return typeof body.error.code === 'string' ? body.error.code : undefined;
}

export class BayaanSettingsApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryAfterMs?: number,
  ) {
    super('Bayaan settings request failed');
    this.name = 'BayaanSettingsApiError';
  }
}

export class BayaanSettingsApiClient {
  private readonly fetchImpl: BoundedFetch;
  private readonly timeoutMs: number;

  constructor(
    private readonly apiUrl: string,
    options: {fetchImpl?: BoundedFetch; timeoutMs?: number} = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? expoFetch;
    this.timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  }

  private async request(
    path: string,
    sessionToken: string,
    init: RequestInit = {},
  ): Promise<{response: Response; body: unknown | null}> {
    try {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${sessionToken}`);
      headers.set('Accept', 'application/json');
      return await boundedJsonRequest(
        this.fetchImpl,
        joinUrl(this.apiUrl, path),
        {...init, headers},
        {timeoutMs: this.timeoutMs, maxResponseBytes: MAX_RESPONSE_BYTES},
      );
    } catch (error) {
      throw new BayaanSettingsApiError(
        0,
        error instanceof BoundedHttpError ? error.code : 'network_error',
      );
    }
  }

  private assertOk(response: Response, body: unknown | null): void {
    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after');
      const seconds =
        retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : NaN;
      const deadline =
        retryAfter && !Number.isFinite(seconds) ? Date.parse(retryAfter) : NaN;
      const delay = Number.isFinite(seconds)
        ? seconds * 1000
        : deadline - Date.now();
      const retryAfterMs =
        Number.isFinite(delay) && delay >= 0
          ? Math.min(delay, 3_600_000)
          : undefined;
      throw new BayaanSettingsApiError(
        response.status,
        serviceCode(body) ?? 'settings_request_failed',
        retryAfterMs,
      );
    }
  }

  async getPreferences(sessionToken: string): Promise<Record<string, unknown>> {
    const {response, body} = await this.request(
      '/v1/qf/settings/preferences',
      sessionToken,
    );
    this.assertOk(response, body);
    if (!isObject(body) || body.success !== true || !isObject(body.data)) {
      throw new BayaanSettingsApiError(
        response.status,
        'invalid_preferences_response',
      );
    }
    return body.data;
  }

  async putPreferences(
    sessionToken: string,
    mutations: PreferenceMutation[],
  ): Promise<void> {
    const {response, body} = await this.request(
      '/v1/qf/settings/preferences',
      sessionToken,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({mutations}),
      },
    );
    this.assertOk(response, body);
  }

  async assertConfiguration(sessionToken: string): Promise<void> {
    const {response, body} = await this.request(
      '/v1/qf/settings/app-state/config',
      sessionToken,
    );
    this.assertOk(response, body);
    const data =
      isObject(body) && body.success === true && isObject(body.data)
        ? body.data
        : null;
    const collections =
      data && Array.isArray(data.collections) ? data.collections : [];
    const settings = collections.find(
      item => isObject(item) && item.name === 'settings',
    );
    if (!isObject(settings) || settings.requiresPrecondition !== true) {
      throw new BayaanSettingsApiError(
        403,
        'settings_collection_not_configured',
      );
    }
  }

  async getDocument(
    sessionToken: string,
    key: SettingsDocumentKey,
  ): Promise<RemoteSettingsDocument | null> {
    const {response, body} = await this.request(
      `/v1/qf/settings/app-state/documents/${key}`,
      sessionToken,
    );
    if (response.status === 404) return null;
    this.assertOk(response, body);
    const data =
      isObject(body) && body.success === true && isObject(body.data)
        ? body.data
        : null;
    const etag = response.headers.get('etag');
    if (
      !data ||
      data.collection !== 'settings' ||
      data.key !== key ||
      !Number.isSafeInteger(data.schemaVersion) ||
      (data.schemaVersion as number) < 1 ||
      ((data.schemaVersion as number) > 1 && data.readOnly !== true) ||
      (data.readOnly !== undefined && typeof data.readOnly !== 'boolean') ||
      !isObject(data.value) ||
      !etag
    ) {
      throw new BayaanSettingsApiError(
        response.status,
        'invalid_document_response',
      );
    }
    return {
      key,
      value: data.value,
      etag,
      schemaVersion: data.schemaVersion as number,
      readOnly: data.readOnly === true || (data.schemaVersion as number) > 1,
    };
  }

  async putDocument(
    sessionToken: string,
    input: {
      key: SettingsDocumentKey;
      body: string;
      idempotencyKey: string;
      etag?: string;
    },
  ): Promise<string> {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    });
    if (input.etag) headers.set('If-Match', input.etag);
    else headers.set('If-None-Match', '*');
    const {response, body} = await this.request(
      `/v1/qf/settings/app-state/documents/${input.key}`,
      sessionToken,
      {method: 'PUT', headers, body: input.body},
    );
    this.assertOk(response, body);
    const etag = response.headers.get('etag');
    if (!etag) {
      throw new BayaanSettingsApiError(
        response.status,
        'missing_document_etag',
      );
    }
    return etag;
  }
}
