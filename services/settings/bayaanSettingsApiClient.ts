import {
  type BoundedFetch,
  BoundedHttpError,
  boundedJsonRequest,
} from '@/services/network/boundedHttp';

const TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 256 * 1024;
// Every highlights document in one listing: up to 114 surahs.
const MAX_HIGHLIGHTS_RESPONSE_BYTES = 1024 * 1024;
// Every document of one library collection: up to 115 (library) or 100
// (playlists) documents of at most 16 KB.
const MAX_LIBRARY_RESPONSE_BYTES = 2 * 1024 * 1024;
const LIBRARY_KEY = /^[A-Za-z0-9_-]{1,64}$/;

export type SettingsDocumentKey =
  | 'appearance'
  | 'mushaf'
  | 'audio'
  | 'adhkar'
  | 'browsing';

/**
 * Every document of the `settings` collection. `content` lists installed
 * editions and is synced by qfInstalledContentSync, not the settings sync.
 */
export type AppStateSettingsKey = SettingsDocumentKey | 'content';

export interface PreferenceMutation {
  group: string;
  key: string;
  value: unknown;
}

export interface RemoteSettingsDocument<
  K extends AppStateSettingsKey = SettingsDocumentKey,
> {
  key: K;
  value: Record<string, unknown>;
  etag: string;
  // Newer schemas can be projected for display, never downgraded on write.
  schemaVersion?: number;
  readOnly?: boolean;
}

/** Bayaan's library App State collections (see qfLibraryDocuments.ts). */
export type LibraryCollection = 'library' | 'playlists' | 'adhkar';

/** A listed library document; read-only ones carry no value. */
export interface RemoteLibraryDocument {
  key: string;
  etag: string;
  value?: unknown;
  readOnly: boolean;
}

/** A listed highlights document; read-only ones carry no value. */
export interface RemoteHighlightsDocument {
  surahNumber: number;
  etag: string;
  value?: unknown;
  readOnly: boolean;
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
    maxResponseBytes = MAX_RESPONSE_BYTES,
  ): Promise<{response: Response; body: unknown | null}> {
    try {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${sessionToken}`);
      headers.set('Accept', 'application/json');
      return await boundedJsonRequest(
        this.fetchImpl,
        joinUrl(this.apiUrl, path),
        {...init, headers},
        {timeoutMs: this.timeoutMs, maxResponseBytes},
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

  async getDocument<K extends AppStateSettingsKey>(
    sessionToken: string,
    key: K,
  ): Promise<RemoteSettingsDocument<K> | null> {
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
      key: AppStateSettingsKey;
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

  async listHighlights(
    sessionToken: string,
  ): Promise<RemoteHighlightsDocument[]> {
    const {response, body} = await this.request(
      '/v1/qf/settings/app-state/highlights',
      sessionToken,
      {},
      MAX_HIGHLIGHTS_RESPONSE_BYTES,
    );
    this.assertOk(response, body);
    const items =
      isObject(body) &&
      body.success === true &&
      isObject(body.data) &&
      Array.isArray(body.data.items)
        ? body.data.items
        : null;
    if (!items) {
      throw new BayaanSettingsApiError(
        response.status,
        'invalid_highlights_response',
      );
    }
    return items.map(item => {
      const surahNumber =
        isObject(item) && typeof item.key === 'string' ? Number(item.key) : NaN;
      if (
        !isObject(item) ||
        !Number.isInteger(surahNumber) ||
        surahNumber < 1 ||
        surahNumber > 114 ||
        typeof item.etag !== 'string' ||
        !item.etag
      ) {
        throw new BayaanSettingsApiError(
          response.status,
          'invalid_highlights_response',
        );
      }
      return {
        surahNumber,
        etag: item.etag,
        value: item.value,
        readOnly: item.readOnly === true,
      };
    });
  }

  async putHighlights(
    sessionToken: string,
    input: {
      surahNumber: number;
      value: unknown;
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
      `/v1/qf/settings/app-state/highlights/${input.surahNumber}`,
      sessionToken,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({schemaVersion: 1, value: input.value}),
      },
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

  /** App State collections QF has enabled for this client. */
  async getAppStateCollections(sessionToken: string): Promise<string[]> {
    const {response, body} = await this.request(
      '/v1/qf/settings/app-state/config',
      sessionToken,
    );
    this.assertOk(response, body);
    const data =
      isObject(body) && body.success === true && isObject(body.data)
        ? body.data
        : null;
    if (!data || !Array.isArray(data.collections)) {
      throw new BayaanSettingsApiError(
        response.status,
        'invalid_configuration_response',
      );
    }
    return data.collections.flatMap(item =>
      isObject(item) && typeof item.name === 'string' ? [item.name] : [],
    );
  }

  async listLibrary(
    sessionToken: string,
    collection: LibraryCollection,
  ): Promise<RemoteLibraryDocument[]> {
    const {response, body} = await this.request(
      `/v1/qf/settings/app-state/collections/${collection}`,
      sessionToken,
      {},
      MAX_LIBRARY_RESPONSE_BYTES,
    );
    this.assertOk(response, body);
    const items =
      isObject(body) &&
      body.success === true &&
      isObject(body.data) &&
      Array.isArray(body.data.items)
        ? body.data.items
        : null;
    if (!items) {
      throw new BayaanSettingsApiError(
        response.status,
        'invalid_library_response',
      );
    }
    return items.map(item => {
      if (
        !isObject(item) ||
        typeof item.key !== 'string' ||
        !LIBRARY_KEY.test(item.key) ||
        typeof item.etag !== 'string' ||
        !item.etag
      ) {
        throw new BayaanSettingsApiError(
          response.status,
          'invalid_library_response',
        );
      }
      return {
        key: item.key,
        etag: item.etag,
        value: item.value,
        readOnly: item.readOnly === true,
      };
    });
  }

  async putLibrary(
    sessionToken: string,
    input: {
      collection: LibraryCollection;
      key: string;
      value: unknown;
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
      `/v1/qf/settings/app-state/collections/${input.collection}/${encodeURIComponent(input.key)}`,
      sessionToken,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({schemaVersion: 1, value: input.value}),
      },
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

  /** Deletes a document; one already gone counts as deleted. */
  async deleteLibrary(
    sessionToken: string,
    input: {
      collection: LibraryCollection;
      key: string;
      idempotencyKey: string;
      etag: string;
    },
  ): Promise<void> {
    const {response, body} = await this.request(
      `/v1/qf/settings/app-state/collections/${input.collection}/${encodeURIComponent(input.key)}`,
      sessionToken,
      {
        method: 'DELETE',
        headers: {
          'Idempotency-Key': input.idempotencyKey,
          'If-Match': input.etag,
        },
      },
    );
    this.assertOk(response, body);
  }

  async postActivityDay(
    sessionToken: string,
    input: {
      idempotencyKey: string;
      /** Only for reading from an earlier day; QF dates today's by timezone. */
      date?: string;
      timezone: string;
      seconds: number;
      ranges: string[];
    },
  ): Promise<void> {
    const {response, body} = await this.request(
      '/v1/qf/settings/activity-days',
      sessionToken,
      {
        method: 'POST',
        headers: new Headers({
          'Content-Type': 'application/json',
          'Idempotency-Key': input.idempotencyKey,
        }),
        body: JSON.stringify({
          ...(input.date === undefined ? {} : {date: input.date}),
          timezone: input.timezone,
          seconds: input.seconds,
          ranges: input.ranges,
        }),
      },
    );
    this.assertOk(response, body);
  }
}
