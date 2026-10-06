import {
  BayaanSyncApiClient,
  BayaanSyncApiError,
} from '@/services/sync/bayaanSyncApiClient';

jest.mock('expo/fetch', () => ({
  fetch: (...args: unknown[]) =>
    (global.fetch as (...values: unknown[]) => unknown)(...args),
}));

const apiUrl = 'https://api-prelive.thebayaan.com';
const opaqueSession = 'opaque-bayaan-session';

function jsonResponse(body: unknown, status = 200): Response {
  const text = JSON.stringify(body);
  const bytes = new TextEncoder().encode(text);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({'content-length': String(Buffer.byteLength(text))}),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    text: () => Promise.resolve(text),
    json: () => Promise.resolve(body),
  } as Response;
}

describe('Bayaan Sync BFF client', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it.each(['45', new Date(Date.now() + 45_000).toUTCString()])(
    'exposes Retry-After from the provider (%s)',
    async retryAfter => {
      const response = jsonResponse({error: {code: 'rate_limited'}}, 429);
      response.headers.set('Retry-After', retryAfter);
      (global.fetch as jest.Mock).mockResolvedValueOnce(response);
      const client = new BayaanSyncApiClient({apiUrl});
      try {
        await client.pull(opaqueSession, {mutationsSince: 0});
        throw new Error('Expected rate limit rejection');
      } catch (error) {
        expect(error).toMatchObject({
          code: 'rate_limited',
          status: 429,
          retryAfterMs: expect.any(Number),
        });
        expect((error as BayaanSyncApiError).retryAfterMs).toBeGreaterThan(
          40_000,
        );
        expect((error as BayaanSyncApiError).retryAfterMs).toBeLessThanOrEqual(
          45_000,
        );
      }
    },
  );

  it('pulls only through the fixed Bayaan route with the opaque session bearer', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          lastMutationAt: 7001,
          mutations: [],
          page: 1,
          limit: 1000,
          total: 0,
          hasMore: false,
        },
      }),
    );
    const client = new BayaanSyncApiClient({apiUrl});

    await client.pull(opaqueSession, {
      mutationsSince: 0,
      metadataOnly: false,
      page: 1,
      limit: 1000,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://api-prelive.thebayaan.com/v1/qf/sync?mutationsSince=0&resources=BOOKMARK%2CNOTE%2CREADING_SESSION&metadataOnly=false&limit=1000&page=1',
    );
    expect(init).toEqual(
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer opaque-bayaan-session',
        },
      }),
    );
    const requestText = JSON.stringify({url, init});
    expect(requestText).not.toContain('x-auth-token');
    expect(requestText).not.toContain('x-client-id');
    expect(requestText).not.toContain('quran.foundation');
    expect(requestText).not.toContain('subject');
    expect(requestText).not.toContain('client-secret');
  });

  it('decodes only the allowlisted pull response and mutation fields', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          lastMutationAt: 7001,
          mutations: [
            {
              resource: 'NOTE',
              type: 'UPDATE',
              resourceId: 'remote-note-1',
              timestamp: 7000,
              data: {
                body: 'Reflect',
                ranges: ['2:255-2:255'],
                saveToQR: false,
                clientCreatedAt: '2026-08-24T00:00:00.000Z',
                clientUpdatedAt: '2026-08-24T00:01:00.000Z',
              },
            },
          ],
          page: 1,
          limit: 1000,
          total: 1,
          hasMore: false,
        },
      }),
    );
    const client = new BayaanSyncApiClient({apiUrl});

    await expect(
      client.pull(opaqueSession, {mutationsSince: 0, page: 1, limit: 1000}),
    ).resolves.toEqual({
      lastMutationAt: 7001,
      mutations: [
        {
          resource: 'NOTE',
          type: 'UPDATE',
          resourceId: 'remote-note-1',
          timestamp: 7000,
          data: {
            body: 'Reflect',
            ranges: ['2:255-2:255'],
            saveToQR: false,
            clientCreatedAt: '2026-08-24T00:00:00.000Z',
            clientUpdatedAt: '2026-08-24T00:01:00.000Z',
          },
        },
      ],
      page: 1,
      limit: 1000,
      total: 1,
      hasMore: false,
    });
  });

  it('accepts and normalizes empty BFF delete data for every synced resource', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          lastMutationAt: 7001,
          mutations: [
            {
              resource: 'BOOKMARK',
              type: 'DELETE',
              resourceId: 'remote-bookmark-1',
              timestamp: 6998,
              data: {},
            },
            {
              resource: 'NOTE',
              type: 'DELETE',
              resourceId: 'remote-note-1',
              timestamp: 6999,
              data: {},
            },
            {
              resource: 'READING_SESSION',
              type: 'DELETE',
              resourceId: 'remote-reading-1',
              timestamp: 7000,
              data: {},
            },
          ],
          page: 1,
          limit: 1000,
          total: 3,
          hasMore: false,
        },
      }),
    );
    const client = new BayaanSyncApiClient({apiUrl});

    await expect(
      client.pull(opaqueSession, {mutationsSince: 0, page: 1, limit: 1000}),
    ).resolves.toEqual({
      lastMutationAt: 7001,
      mutations: [
        {
          resource: 'BOOKMARK',
          type: 'DELETE',
          resourceId: 'remote-bookmark-1',
          timestamp: 6998,
        },
        {
          resource: 'NOTE',
          type: 'DELETE',
          resourceId: 'remote-note-1',
          timestamp: 6999,
        },
        {
          resource: 'READING_SESSION',
          type: 'DELETE',
          resourceId: 'remote-reading-1',
          timestamp: 7000,
        },
      ],
      page: 1,
      limit: 1000,
      total: 3,
      hasMore: false,
    });
  });

  it('rejects non-empty delete data', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          lastMutationAt: 1,
          mutations: [
            {
              resource: 'BOOKMARK',
              type: 'DELETE',
              resourceId: 'remote-bookmark-1',
              timestamp: 1,
              data: {key: 2},
            },
          ],
        },
      }),
    );
    const client = new BayaanSyncApiClient({apiUrl});

    await expect(
      client.pull(opaqueSession, {mutationsSince: 0, page: 1, limit: 1000}),
    ).rejects.toMatchObject({code: 'invalid_response'});
  });

  it.each([
    [
      'contradictory hasMore',
      {page: 1, limit: 1000, total: 1500, hasMore: false},
    ],
    ['wrong returned page', {page: 2, limit: 1000, total: 0, hasMore: false}],
    ['wrong returned limit', {page: 1, limit: 500, total: 0, hasMore: false}],
    ['incomplete pagination', {page: 1, limit: 1000, hasMore: false}],
  ])('rejects %s pagination metadata', async (_name, pagination) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          lastMutationAt: 1,
          mutations: [],
          ...pagination,
        },
      }),
    );
    const client = new BayaanSyncApiClient({apiUrl});

    await expect(
      client.pull(opaqueSession, {mutationsSince: 0, page: 1, limit: 1000}),
    ).rejects.toMatchObject({code: 'invalid_response'});
  });

  it.each([
    [
      'unknown response field',
      {
        success: true,
        data: {lastMutationAt: 1, mutations: [], upstreamToken: 'forbidden'},
      },
    ],
    [
      'unknown mutation resource',
      {
        success: true,
        data: {
          lastMutationAt: 1,
          mutations: [
            {
              resource: 'COLLECTION',
              type: 'DELETE',
              resourceId: 'collection-1',
              timestamp: 1,
            },
          ],
        },
      },
    ],
    [
      'public Quran Reflect note',
      {
        success: true,
        data: {
          lastMutationAt: 1,
          mutations: [
            {
              resource: 'NOTE',
              type: 'CREATE',
              resourceId: 'note-1',
              timestamp: 1,
              data: {
                body: 'unsafe public note',
                ranges: ['2:255-2:255'],
                saveToQR: true,
              },
            },
          ],
        },
      },
    ],
  ])('rejects %s without exposing the response body', async (_name, body) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(body));
    const client = new BayaanSyncApiClient({apiUrl});

    const error = await client
      .pull(opaqueSession, {mutationsSince: 0, page: 1, limit: 1000})
      .catch(value => value);

    expect(error).toBeInstanceOf(BayaanSyncApiError);
    expect(error).toMatchObject({code: 'invalid_response'});
    expect(error.message).toBe('Bayaan Sync request failed');
    expect(error.message).not.toContain(JSON.stringify(body));
  });

  it.each([
    [401, 'session_revoked'],
    [409, 'sync_conflict'],
    [429, 'rate_limited'],
    [500, 'service_unavailable'],
    [503, 'service_unavailable'],
  ])('maps BFF %i to stable %s without raw bodies', async (status, code) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse(
        {error: {code: 'UPSTREAM_SECRET', detail: 'raw-body'}},
        status,
      ),
    );
    const client = new BayaanSyncApiClient({apiUrl});

    await expect(
      client.pull(opaqueSession, {mutationsSince: 0, page: 1, limit: 1000}),
    ).rejects.toMatchObject({
      code,
      status,
      message: 'Bayaan Sync request failed',
    });
  });

  it.each([
    {error: {code: 'QF_SYNC_RESPONSE_TOO_LARGE'}},
    {
      error: {
        code: 'QF_SYNC_RESPONSE_TOO_LARGE',
        message: 'Bounded provider page',
      },
    },
  ])('recognizes only the typed GET 502 size envelope (%j)', async body => {
    const client = new BayaanSyncApiClient({
      apiUrl,
      fetchImpl: jest.fn().mockResolvedValue(jsonResponse(body, 502)),
    });
    await expect(
      client.pull(opaqueSession, {mutationsSince: 7001}),
    ).rejects.toMatchObject({
      code: 'response_too_large',
      status: 502,
      message: 'Bayaan Sync request failed',
    });
  });

  it.each([
    [502, {error: {code: 'QF_SYNC_INVALID_RESPONSE'}}, 'service_unavailable'],
    [502, {error: {code: 'QF_SYNC_UPSTREAM_ERROR'}}, 'service_unavailable'],
    [503, {error: {code: 'QF_SYNC_RESPONSE_TOO_LARGE'}}, 'service_unavailable'],
    [413, {error: {code: 'QF_SYNC_RESPONSE_TOO_LARGE'}}, 'request_failed'],
    [200, {error: {code: 'QF_SYNC_RESPONSE_TOO_LARGE'}}, 'invalid_response'],
    [502, {code: 'QF_SYNC_RESPONSE_TOO_LARGE'}, 'service_unavailable'],
    [502, {error: 'QF_SYNC_RESPONSE_TOO_LARGE'}, 'service_unavailable'],
    [
      502,
      {error: [{code: 'QF_SYNC_RESPONSE_TOO_LARGE'}]},
      'service_unavailable',
    ],
    [
      502,
      {error: {code: ['QF_SYNC_RESPONSE_TOO_LARGE']}},
      'service_unavailable',
    ],
    [
      502,
      {
        error: {
          code: 'QF_SYNC_RESPONSE_TOO_LARGE',
          message: {private: 'not-a-string'},
        },
      },
      'service_unavailable',
    ],
    [
      502,
      {error: {code: 'QF_SYNC_RESPONSE_TOO_LARGE', upstreamToken: 'private'}},
      'service_unavailable',
    ],
    [
      502,
      {error: {code: 'QF_SYNC_RESPONSE_TOO_LARGE'}, upstreamBody: 'private'},
      'service_unavailable',
    ],
    [502, null, 'service_unavailable'],
  ])(
    'does not classify status %s or a malformed/other error envelope as oversized (%j)',
    async (status, body, code) => {
      const client = new BayaanSyncApiClient({
        apiUrl,
        fetchImpl: jest
          .fn()
          .mockResolvedValue(jsonResponse(body, Number(status))),
      });
      const error = await client
        .pull(opaqueSession, {mutationsSince: 7001})
        .catch(value => value);
      expect(error).toMatchObject({
        code,
        status,
        message: 'Bayaan Sync request failed',
      });
      expect(JSON.stringify(error)).not.toContain('private');
    },
  );

  it.each(['declared', 'stream', 'invalid-json'] as const)(
    'keeps an unreadable GET 502 %s error body generic and bounded',
    async mode => {
      const cancel = jest.fn();
      const bytes = new TextEncoder().encode(
        mode === 'invalid-json' ? '{not-json' : 'x'.repeat(2 * 1024 * 1024 + 1),
      );
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(bytes);
          if (mode === 'invalid-json') c.close();
        },
        cancel,
      });
      const response = {
        ok: false,
        status: 502,
        headers: new Headers(
          mode === 'declared' ? {'content-length': String(bytes.length)} : {},
        ),
        body: stream,
      } as Response;
      const client = new BayaanSyncApiClient({
        apiUrl,
        fetchImpl: jest.fn().mockResolvedValue(response),
      });
      await expect(
        client.pull(opaqueSession, {mutationsSince: 7001}),
      ).rejects.toMatchObject({code: 'service_unavailable', status: 502});
      if (mode !== 'invalid-json') expect(cancel).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps the deadline active while reading the opt-in GET 502 error body', async () => {
    const response = jsonResponse(
      {error: {code: 'QF_SYNC_RESPONSE_TOO_LARGE'}},
      502,
    );
    const stalled = new ReadableStream<Uint8Array>();
    const fetchImpl = jest.fn(
      async (_url: string, init?: RequestInit) =>
        ({...response, body: stalled, signal: init?.signal}) as Response,
    );
    const client = new BayaanSyncApiClient({apiUrl, fetchImpl, timeoutMs: 5});
    await expect(
      client.pull(opaqueSession, {mutationsSince: 7001}),
    ).rejects.toMatchObject({code: 'service_unavailable', status: 0});
    expect(fetchImpl.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it('does not read or reinterpret a typed POST 502 error as a pull size hint', async () => {
    const response = jsonResponse(
      {error: {code: 'QF_SYNC_RESPONSE_TOO_LARGE'}},
      502,
    );
    const stream = response.body;
    if (!stream) throw new Error('Expected a readable test response');
    const read = jest.spyOn(stream, 'getReader');
    const client = new BayaanSyncApiClient({
      apiUrl,
      fetchImpl: jest.fn().mockResolvedValue(response),
    });
    await expect(
      client.push(opaqueSession, {
        lastMutationAt: 7001,
        mutations: [
          {
            resource: 'NOTE',
            type: 'CREATE',
            data: {
              body: 'private reflection',
              ranges: ['2:255-2:255'],
              saveToQR: false,
            },
          },
        ],
      }),
    ).rejects.toMatchObject({code: 'service_unavailable', status: 502});
    expect(read).not.toHaveBeenCalled();
  });

  it('aborts a stalled sync request at its deadline', async () => {
    let observedSignal: AbortSignal | undefined;
    const fetchImpl = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          observedSignal = init?.signal ?? undefined;
          setTimeout(() => reject(new Error('late network failure')), 25);
        }),
    ) as unknown as typeof fetch;
    const client = new BayaanSyncApiClient({apiUrl, fetchImpl, timeoutMs: 5});

    await expect(
      client.pull(opaqueSession, {mutationsSince: 0}),
    ).rejects.toMatchObject({code: 'service_unavailable'});
    expect(observedSignal?.aborted).toBe(true);
  });

  it.each([
    {type: 'ayah', key: 2, verseNumber: null},
    {type: 'ayah', key: 2, verseNumber: null, isInDefaultCollection: true},
    {type: 'ayah', key: 2, verseNumber: 255, isInDefaultCollection: 'true'},
    {type: 'unknownType', key: 10, verseNumber: null},
    {type: 'page', bookmarkType: 'ayah', key: 10, verseNumber: null},
    {type: 'juz', key: 0, verseNumber: null},
    {type: 'surah', key: 10, verseNumber: 'invalid'},
    {type: 'page', key: 10, verseNumber: null, unknownField: true},
    {type: 'page', key: 10, verseNumber: null, clientUpdatedAt: 'invalid'},
  ])(
    'rejects malformed bookmark data rather than projecting it: %j',
    async data => {
      const fetchImpl = jest.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: {
            lastMutationAt: 1,
            mutations: [
              {
                resource: 'BOOKMARK',
                type: 'CREATE',
                resourceId: 'malformed',
                timestamp: 1,
                data,
              },
            ],
          },
        }),
      );
      await expect(
        new BayaanSyncApiClient({apiUrl, fetchImpl}).pull(opaqueSession, {
          mutationsSince: 0,
        }),
      ).rejects.toMatchObject({code: 'invalid_response'});
    },
  );

  it.each(['type', 'bookmarkType'] as const)(
    'projects only recognized non-ayah %s while retaining unprojected count',
    async field => {
      const mutations = ['page', 'juz', 'surah'].map((type, index) => ({
        resource: 'BOOKMARK',
        type: 'CREATE',
        resourceId: type,
        timestamp: 1,
        data: {
          [field]: type,
          key: 10,
          ...(index === 0 ? {} : {verseNumber: index === 1 ? null : 1}),
        },
      }));
      const fetchImpl = jest
        .fn()
        .mockResolvedValue(
          jsonResponse({success: true, data: {lastMutationAt: 1, mutations}}),
        );
      await expect(
        new BayaanSyncApiClient({apiUrl, fetchImpl}).pull(opaqueSession, {
          mutationsSince: 0,
        }),
      ).resolves.toEqual({
        lastMutationAt: 1,
        mutations: [],
        receivedMutationCount: 3,
      });
    },
  );

  it.each(['CREATE', 'UPDATE'] as const)(
    'excludes known Favorites %s reads without changing raw pagination or tombstones',
    async type => {
      const favorite = {
        resource: 'BOOKMARK' as const,
        type,
        resourceId: 'favorite',
        timestamp: 2,
        data: {
          bookmarkType: 'ayah',
          key: 2,
          verseNumber: 255,
          isInDefaultCollection: true,
        },
      };
      const live = {
        ...favorite,
        resourceId: 'standalone',
        data: {...favorite.data, isInDefaultCollection: false},
      };
      const legacy = {
        ...favorite,
        resourceId: 'membership-unknown',
        data: {type: 'ayah', key: 3, verseNumber: 1},
      };
      const tombstone = {
        resource: 'BOOKMARK',
        type: 'DELETE',
        resourceId: 'favorite',
        timestamp: 3,
      };
      const fetchImpl = jest.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: {
            lastMutationAt: 3,
            mutations: [favorite, live, legacy, tombstone],
            page: 1,
            limit: 4,
            total: 5,
            hasMore: true,
          },
        }),
      );
      const client = new BayaanSyncApiClient({apiUrl, fetchImpl});
      await expect(
        client.pull(opaqueSession, {mutationsSince: 0, page: 1, limit: 4}),
      ).resolves.toEqual({
        lastMutationAt: 3,
        mutations: [live, legacy, tombstone],
        receivedMutationCount: 4,
        page: 1,
        limit: 4,
        total: 5,
        hasMore: true,
      });
      // A successful push receipt is never projected away, even if it reveals
      // collection membership. This does not authorize collection writes.
      fetchImpl.mockResolvedValue(
        jsonResponse({
          success: true,
          data: {lastMutationAt: 2, mutations: [favorite]},
        }),
      );
      await expect(
        client.push(opaqueSession, {
          lastMutationAt: 1,
          mutations: [
            {
              resource: 'BOOKMARK',
              type: 'CREATE',
              data: {type: 'ayah', key: 2, verseNumber: 255},
            },
          ],
        }),
      ).resolves.toEqual({lastMutationAt: 2, mutations: [favorite]});
    },
  );

  it('never filters unsupported push receipts or authorizes non-ayah outbound effects', async () => {
    const mutation = {
      resource: 'BOOKMARK' as const,
      type: 'CREATE' as const,
      resourceId: 'page',
      timestamp: 2,
      data: {type: 'page', key: 10},
    };
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {lastMutationAt: 2, mutations: [mutation]},
      }),
    );
    const client = new BayaanSyncApiClient({apiUrl, fetchImpl});
    await expect(
      client.push(opaqueSession, {
        lastMutationAt: 1,
        mutations: [
          {
            resource: 'BOOKMARK',
            type: 'CREATE',
            data: {type: 'ayah', key: 2, verseNumber: 255},
          },
        ],
      }),
    ).rejects.toMatchObject({code: 'invalid_response'});
    await expect(
      client.push(opaqueSession, {lastMutationAt: 1, mutations: [mutation]}),
    ).rejects.toMatchObject({code: 'request_failed'});
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized successful sync JSON without parsing it', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({'content-length': '2097153'}),
      text: jest.fn(),
    } as unknown as Response);
    const client = new BayaanSyncApiClient({apiUrl, fetchImpl});

    await expect(
      client.pull(opaqueSession, {mutationsSince: 0}),
    ).rejects.toMatchObject({code: 'response_too_large', status: 200});
    expect(fetchImpl.mock.results[0]).toBeDefined();
  });
});
