import {
  BayaanSettingsApiClient,
  BayaanSettingsApiError,
} from '../bayaanSettingsApiClient';

function jsonResponse(
  value: unknown,
  options: {status?: number; headers?: Record<string, string>} = {},
): Response {
  const status = options.status ?? 200;
  const text = JSON.stringify(value);
  const bytes = new TextEncoder().encode(text);
  const headers = new Headers({
    'content-type': 'application/json',
    'content-length': String(bytes.byteLength),
    ...options.headers,
  });
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  } as Response;
}

describe('BayaanSettingsApiClient', () => {
  test('uses only the opaque Bayaan session and decodes Preferences', async () => {
    let captured: {url: string; headers: Headers} | undefined;
    const client = new BayaanSettingsApiClient('https://bayaan.test', {
      fetchImpl: jest.fn(async (url, init) => {
        captured = {url, headers: new Headers(init?.headers)};
        return jsonResponse({
          success: true,
          data: {theme: {type: 'dark'}},
        });
      }),
    });

    await expect(client.getPreferences('opaque-session')).resolves.toEqual({
      theme: {type: 'dark'},
    });
    expect(captured?.url).toBe(
      'https://bayaan.test/v1/qf/settings/preferences',
    );
    expect(captured?.headers.get('authorization')).toBe(
      'Bearer opaque-session',
    );
    expect(captured?.headers.get('x-auth-token')).toBeNull();
    expect(captured?.headers.get('x-client-id')).toBeNull();
  });

  test('validates the strict settings collection configuration', async () => {
    const configured = new BayaanSettingsApiClient('https://bayaan.test', {
      fetchImpl: jest.fn(async () =>
        jsonResponse({
          success: true,
          data: {
            collections: [{name: 'settings', requiresPrecondition: true}],
          },
        }),
      ),
    });
    await expect(
      configured.assertConfiguration('opaque-session'),
    ).resolves.toBeUndefined();

    const unsafe = new BayaanSettingsApiClient('https://bayaan.test', {
      fetchImpl: jest.fn(async () =>
        jsonResponse({
          success: true,
          data: {
            collections: [{name: 'settings', requiresPrecondition: false}],
          },
        }),
      ),
    });
    await expect(unsafe.assertConfiguration('opaque-session')).rejects.toEqual(
      new BayaanSettingsApiError(403, 'settings_collection_not_configured'),
    );
  });

  test('treats 404 as absence and rejects malformed App State documents', async () => {
    const missing = new BayaanSettingsApiClient('https://bayaan.test', {
      fetchImpl: jest.fn(async () =>
        jsonResponse({error: {code: 'not_found'}}, {status: 404}),
      ),
    });
    await expect(
      missing.getDocument('opaque-session', 'mushaf'),
    ).resolves.toBeNull();

    const malformed = new BayaanSettingsApiClient('https://bayaan.test', {
      fetchImpl: jest.fn(async () =>
        jsonResponse({
          success: true,
          data: {
            collection: 'settings',
            key: 'mushaf',
            schemaVersion: 2,
            value: {},
          },
        }),
      ),
    });
    await expect(
      malformed.getDocument('opaque-session', 'mushaf'),
    ).rejects.toEqual(
      new BayaanSettingsApiError(200, 'invalid_document_response'),
    );
  });

  test('accepts explicit future-schema read-only documents without relabeling their version', async () => {
    const client = new BayaanSettingsApiClient('https://bayaan.test', {
      fetchImpl: jest.fn(async () =>
        jsonResponse(
          {
            success: true,
            data: {
              collection: 'settings',
              key: 'mushaf',
              schemaVersion: 2,
              readOnly: true,
              value: {showWBW: true},
            },
          },
          {headers: {etag: 'future-etag'}},
        ),
      ),
    });
    await expect(client.getDocument('session', 'mushaf')).resolves.toEqual({
      key: 'mushaf',
      value: {showWBW: true},
      schemaVersion: 2,
      readOnly: true,
      etag: 'future-etag',
    });
  });

  test('bounds and exposes Retry-After for reconciliation backoff', async () => {
    const client = new BayaanSettingsApiClient('https://bayaan.test', {
      fetchImpl: jest.fn(async () =>
        jsonResponse(
          {error: {code: 'QF_SETTINGS_RATE_LIMITED'}},
          {status: 429, headers: {'retry-after': '2'}},
        ),
      ),
    });

    await expect(client.getPreferences('opaque-session')).rejects.toMatchObject(
      {
        status: 429,
        retryAfterMs: 2_000,
      },
    );
  });

  test('preserves HTTP-date Retry-After longer than a minute', async () => {
    const now = 1_700_000_000_000;
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const client = new BayaanSettingsApiClient('https://bayaan.test', {
        fetchImpl: async () =>
          jsonResponse(
            {},
            {
              status: 429,
              headers: {'retry-after': new Date(now + 120_000).toUTCString()},
            },
          ),
      });
      await expect(client.getPreferences('session')).rejects.toMatchObject({
        status: 429,
        retryAfterMs: 120_000,
      });
    } finally {
      clock.mockRestore();
    }
  });

  test('sends exact App State bytes with the required mutation headers', async () => {
    let captured: {headers: Headers; body: unknown} | undefined;
    const client = new BayaanSettingsApiClient('https://bayaan.test', {
      fetchImpl: jest.fn(async (_url, init) => {
        captured = {headers: new Headers(init?.headers), body: init?.body};
        return jsonResponse(
          {success: true, data: {version: 2}},
          {headers: {etag: '"new-etag"'}},
        );
      }),
    });
    const body = JSON.stringify({
      value: {themeMode: 'dark'},
      schemaVersion: 1,
    });

    await expect(
      client.putDocument('opaque-session', {
        key: 'appearance',
        body,
        idempotencyKey: 'operation-00000001',
        etag: '"old-etag"',
      }),
    ).resolves.toBe('"new-etag"');
    expect(captured?.body).toBe(body);
    expect(captured?.headers.get('if-match')).toBe('"old-etag"');
    expect(captured?.headers.get('if-none-match')).toBeNull();
    expect(captured?.headers.get('idempotency-key')).toBe('operation-00000001');
  });
});
