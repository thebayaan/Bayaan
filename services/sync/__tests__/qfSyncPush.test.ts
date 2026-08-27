import {
  BayaanSyncApiClient,
  type BayaanSyncPushRequest,
} from '@/services/sync/bayaanSyncApiClient';
import {
  QfSyncCoordinator,
  type QfSyncPushStore,
  type QfSyncTransport,
} from '@/services/sync/qfSyncCoordinator';
import type {QfOutboxEntry} from '@/services/sync/qfSyncDatabaseService';
import type {
  BayaanSyncPullPage,
  BayaanSyncPushResult,
} from '@/services/sync/bayaanSyncCodec';

const accountId = 'reader-a';
const sessionToken = 'opaque-bayaan-session';

function jsonResponse(body: unknown, status = 200): Response {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({'content-length': String(Buffer.byteLength(text))}),
    text: () => Promise.resolve(text),
    json: () => Promise.resolve(body),
  } as Response;
}

function outboxEntry(
  index: number,
  deliveryState: QfOutboxEntry['deliveryState'] = 'PENDING',
): QfOutboxEntry {
  const surahNumber = Math.floor(index / 200) + 1;
  const ayahNumber = (index % 200) + 1;
  return {
    localOperationId: `operation-${index.toString().padStart(3, '0')}`,
    ownerScope: 'qf:reader-a',
    accountId,
    resource: 'BOOKMARK',
    mutationType: 'CREATE',
    localId: `bookmark-${index}`,
    remoteId: null,
    payloadJson: JSON.stringify({
      verseKey: `${surahNumber}:${ayahNumber}`,
      surahNumber,
      ayahNumber,
      clientCreatedAt: 1_700_000_000_000 + index,
      clientUpdatedAt: 1_700_000_000_000 + index,
    }),
    baseServerUpdatedAt: null,
    attempts: 0,
    nextAttemptAt: null,
    createdAt: 1_700_000_000_000 + index,
    revision: 1,
    deliveryState,
    inFlightRevision: deliveryState === 'IN_FLIGHT' ? 1 : null,
    inFlightMutationType: deliveryState === 'IN_FLIGHT' ? 'CREATE' : null,
    inFlightPayloadJson:
      deliveryState === 'IN_FLIGHT'
        ? JSON.stringify({sent: 'durable evidence'})
        : null,
    inFlightStartedAt: deliveryState === 'IN_FLIGHT' ? 1_700_000_001_000 : null,
  };
}

class PushStore implements QfSyncPushStore {
  head = 7001;
  entries: QfOutboxEntry[] = [];
  readonly marked: string[] = [];
  committed:
    | {
        expectedHead: number;
        sent: QfOutboxEntry[];
        result: BayaanSyncPushResult;
      }
    | undefined;

  async getStoredHead(): Promise<number> {
    return this.head;
  }

  async getOutboxEntries(): Promise<QfOutboxEntry[]> {
    return this.entries;
  }

  async reservePushBatch(input: {
    startedAt: number;
    limit: number;
  }): Promise<QfOutboxEntry[]> {
    const candidates = this.entries
      .filter(entry => entry.deliveryState === 'PENDING')
      .slice(0, input.limit);
    return candidates.map(candidate => {
      this.marked.push(candidate.localOperationId);
      const payload = JSON.parse(candidate.payloadJson) as Record<
        string,
        unknown
      >;
      return {
        ...candidate,
        deliveryState: 'IN_FLIGHT' as const,
        inFlightRevision: candidate.revision,
        inFlightMutationType: candidate.mutationType,
        payloadJson: JSON.stringify({
          ...payload,
          clientUpdatedAt: 1_800_000_000_000,
        }),
        inFlightPayloadJson: candidate.payloadJson,
        inFlightStartedAt: input.startedAt,
      };
    });
  }

  async commitPushSuccess(input: {
    expectedHead: number;
    sent: QfOutboxEntry[];
    result: BayaanSyncPushResult;
  }): Promise<boolean> {
    this.committed = input;
    this.head = input.result.lastMutationAt;
    return true;
  }

  async releaseInFlightOperations(): Promise<void> {
    return undefined;
  }

  async reconcileUncertainOperations(): Promise<{
    acknowledged: number;
    ambiguous: number;
  }> {
    return {acknowledged: 0, ambiguous: 0};
  }

  async rebasePendingOperations(): Promise<void> {
    return undefined;
  }
}

class Transport implements QfSyncTransport {
  readonly pushes: BayaanSyncPushRequest[] = [];

  async pull(): Promise<BayaanSyncPullPage> {
    throw new Error('Unexpected pull');
  }

  async push(
    _token: string,
    request: BayaanSyncPushRequest,
  ): Promise<BayaanSyncPushResult> {
    this.pushes.push(request);
    return {
      lastMutationAt: 7101,
      mutations: request.mutations.map((mutation, index) => ({
        ...mutation,
        resourceId: `remote-${index}`,
        timestamp: 7101 + index,
      })),
    };
  }
}

describe('Bayaan Sync exact-head push transport', () => {
  it('posts only to the exact-head Bayaan route and strictly decodes the result', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          lastMutationAt: 7002,
          mutations: [
            {
              resource: 'NOTE',
              type: 'CREATE',
              resourceId: 'remote-note-1',
              timestamp: 7002,
              data: {
                body: 'Private reflection',
                ranges: ['2:255-2:255'],
                saveToQR: false,
                clientCreatedAt: '2026-08-24T00:00:00.000Z',
                clientUpdatedAt: '2026-08-24T00:00:00.000Z',
              },
            },
          ],
        },
      }),
    );
    const client = new BayaanSyncApiClient({
      apiUrl: 'https://api-prelive.thebayaan.com',
      fetchImpl,
    });

    await expect(
      client.push(sessionToken, {
        lastMutationAt: 7001,
        mutations: [
          {
            resource: 'NOTE',
            type: 'CREATE',
            data: {
              body: 'Private reflection',
              ranges: ['2:255-2:255'],
              saveToQR: false,
              clientCreatedAt: '2026-08-24T00:00:00.000Z',
              clientUpdatedAt: '2026-08-24T00:00:00.000Z',
            },
          },
        ],
      }),
    ).resolves.toEqual({
      lastMutationAt: 7002,
      mutations: [
        {
          resource: 'NOTE',
          type: 'CREATE',
          resourceId: 'remote-note-1',
          timestamp: 7002,
          data: {
            body: 'Private reflection',
            ranges: ['2:255-2:255'],
            saveToQR: false,
            clientCreatedAt: '2026-08-24T00:00:00.000Z',
            clientUpdatedAt: '2026-08-24T00:00:00.000Z',
          },
        },
      ],
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api-prelive.thebayaan.com/v1/qf/sync?lastMutationAt=7001',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer opaque-bayaan-session',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mutations: [
            {
              resource: 'NOTE',
              type: 'CREATE',
              data: {
                body: 'Private reflection',
                ranges: ['2:255-2:255'],
                saveToQR: false,
                clientCreatedAt: '2026-08-24T00:00:00.000Z',
                clientUpdatedAt: '2026-08-24T00:00:00.000Z',
              },
            },
          ],
        }),
      }),
    );
  });

  it('rejects a push result with non-allowlisted fields', async () => {
    const client = new BayaanSyncApiClient({
      apiUrl: 'https://api-prelive.thebayaan.com',
      fetchImpl: jest.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: {lastMutationAt: 7002, mutations: [], upstreamToken: 'no'},
        }),
      ),
    });

    await expect(
      client.push(sessionToken, {
        lastMutationAt: 7001,
        mutations: [
          {resource: 'BOOKMARK', type: 'DELETE', resourceId: 'remote-1'},
        ],
      }),
    ).rejects.toMatchObject({
      code: 'invalid_response',
      message: 'Bayaan Sync request failed',
    });
  });

  it('preserves returned tombstones and reading client time for atomic application', async () => {
    const client = new BayaanSyncApiClient({
      apiUrl: 'https://api-prelive.thebayaan.com',
      fetchImpl: jest.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: {
            lastMutationAt: 7003,
            mutations: [
              {
                resource: 'BOOKMARK',
                type: 'DELETE',
                resourceId: 'remote-bookmark-1',
                timestamp: 7002,
              },
              {
                resource: 'READING_SESSION',
                type: 'CREATE',
                resourceId: 'remote-reading-1',
                timestamp: 7003,
                data: {
                  chapterNumber: 3,
                  verseNumber: 8,
                  clientUpdatedAt: '1970-01-01T00:00:09.000Z',
                },
              },
            ],
          },
        }),
      ),
    });

    await expect(
      client.push(sessionToken, {
        lastMutationAt: 7001,
        mutations: [
          {
            resource: 'BOOKMARK',
            type: 'DELETE',
            resourceId: 'remote-bookmark-1',
          },
          {
            resource: 'READING_SESSION',
            type: 'CREATE',
            data: {chapterNumber: 3, verseNumber: 8},
          },
        ],
      }),
    ).resolves.toEqual({
      lastMutationAt: 7003,
      mutations: [
        {
          resource: 'BOOKMARK',
          type: 'DELETE',
          resourceId: 'remote-bookmark-1',
          timestamp: 7002,
        },
        {
          resource: 'READING_SESSION',
          type: 'CREATE',
          resourceId: 'remote-reading-1',
          timestamp: 7003,
          data: {
            chapterNumber: 3,
            verseNumber: 8,
            clientUpdatedAt: '1970-01-01T00:00:09.000Z',
          },
        },
      ],
    });
  });

  it('rejects local-only outbound fields before starting a request', async () => {
    const fetchImpl = jest.fn();
    const client = new BayaanSyncApiClient({
      apiUrl: 'https://api-prelive.thebayaan.com',
      fetchImpl,
    });

    await expect(
      client.push(sessionToken, {
        lastMutationAt: 7001,
        mutations: [
          {
            resource: 'NOTE',
            type: 'CREATE',
            data: {
              body: 'Private reflection',
              ranges: ['2:255-2:255'],
              saveToQR: false,
              rewayahId: 'must-stay-local',
            } as never,
          },
        ],
      }),
    ).rejects.toMatchObject({code: 'request_failed', status: 400});
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a successful response whose head regresses behind the exact request head', async () => {
    const client = new BayaanSyncApiClient({
      apiUrl: 'https://api-prelive.thebayaan.com',
      fetchImpl: jest.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: {lastMutationAt: 7000, mutations: []},
        }),
      ),
    });

    await expect(
      client.push(sessionToken, {
        lastMutationAt: 7001,
        mutations: [
          {resource: 'BOOKMARK', type: 'DELETE', resourceId: 'remote-1'},
        ],
      }),
    ).rejects.toMatchObject({code: 'invalid_response'});
  });
});

describe('QF push coordinator', () => {
  it('marks and sends at most 100 oldest pending rows using only immutable in-flight snapshots', async () => {
    const store = new PushStore();
    store.entries = [
      ...Array.from({length: 105}, (_, index) => outboxEntry(index)),
    ];
    const transport = new Transport();
    const coordinator = new QfSyncCoordinator({
      transport,
      store: store as never,
      pushStore: store,
      now: () => 1_900_000_000_000,
    });

    await expect(coordinator.push({accountId, sessionToken})).resolves.toEqual({
      status: 'synced',
      head: 7101,
      pushed: 100,
    });

    expect(store.marked).toEqual(
      Array.from(
        {length: 100},
        (_, index) => `operation-${index.toString().padStart(3, '0')}`,
      ),
    );
    expect(transport.pushes).toHaveLength(1);
    expect(transport.pushes[0].lastMutationAt).toBe(7001);
    expect(transport.pushes[0].mutations).toHaveLength(100);
    expect(transport.pushes[0].mutations[0]).toMatchObject({
      data: {clientUpdatedAt: '2023-11-14T22:13:20.000Z'},
    });
    expect(store.committed?.sent).toHaveLength(100);
    expect(store.committed?.sent[0]).toMatchObject({
      deliveryState: 'IN_FLIGHT',
      inFlightRevision: 1,
    });
  });

  it('requires a positive stable pull head before the first push', async () => {
    const store = new PushStore();
    store.head = 0;
    store.entries = [outboxEntry(0)];
    const transport = new Transport();
    const coordinator = new QfSyncCoordinator({
      transport,
      store: store as never,
      pushStore: store,
    });

    await expect(coordinator.push({accountId, sessionToken})).resolves.toEqual({
      status: 'deferred',
      reason: 'initial_pull_required',
      retryAfterMs: 250,
    });
    expect(transport.pushes).toEqual([]);
    expect(store.marked).toEqual([]);
  });

  it('serializes overlapping pushes for the same account', async () => {
    const store = new PushStore();
    store.entries = [outboxEntry(0)];
    let releaseFirst!: () => void;
    const firstMayFinish = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let activePushes = 0;
    let maximumActivePushes = 0;
    const transport = new Transport();
    transport.push = async (_token, request) => {
      activePushes += 1;
      maximumActivePushes = Math.max(maximumActivePushes, activePushes);
      await firstMayFinish;
      activePushes -= 1;
      store.entries = [];
      return {
        lastMutationAt: 7101,
        mutations: request.mutations.map(mutation => ({
          ...mutation,
          resourceId: 'remote-1',
          timestamp: 7101,
        })),
      };
    };
    const coordinator = new QfSyncCoordinator({
      transport,
      store: store as never,
      pushStore: store,
    });

    const first = coordinator.push({accountId, sessionToken});
    const second = coordinator.push({accountId, sessionToken});
    await Promise.resolve();
    releaseFirst();

    await expect(Promise.all([first, second])).resolves.toEqual([
      {status: 'synced', head: 7101, pushed: 1},
      {status: 'idle', head: 7101},
    ]);
    expect(maximumActivePushes).toBe(1);
  });
});
