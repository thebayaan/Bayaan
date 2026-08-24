import {
  BayaanSyncApiClient,
  BayaanSyncApiError,
} from '@/services/sync/bayaanSyncApiClient';

const apiUrl = 'https://api-prelive.thebayaan.com';
const opaqueSession = 'opaque-bayaan-session';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('Bayaan Sync BFF client', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

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
    expect(init).toEqual({
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer opaque-bayaan-session',
      },
    });
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
});
