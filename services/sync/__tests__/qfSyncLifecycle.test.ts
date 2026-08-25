jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {BayaanSyncApiError} from '@/services/sync/bayaanSyncApiClient';
import {
  QfSyncLifecycle,
  type QfSyncLifecycleContext,
} from '@/services/sync/qfSyncLifecycle';
import {
  QfReadingSessionService,
  READING_SESSION_DEBOUNCE_MS,
} from '@/services/sync/qfReadingSessionService';
import {useQfSyncStore} from '@/store/qfSyncStore';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {verseAnnotationDatabaseService} from '@/services/database/VerseAnnotationDatabaseService';
import {qfSyncDatabaseService} from '@/services/sync/qfSyncDatabaseService';

const authenticatedOnline: QfSyncLifecycleContext = {
  authStatus: 'authenticated',
  accountId: 'account-a',
  online: true,
  appActive: true,
};

function stablePull(head = 10) {
  return {status: 'synced' as const, head, restarts: 0};
}

function idlePush(head = 10) {
  return {status: 'idle' as const, head};
}

function session(accountId = 'account-a') {
  return {
    token: 'opaque-bayaan-session',
    expiresAt: 99_999,
    profile: {accountId},
  };
}

function createLifecycle(overrides: Record<string, unknown> = {}) {
  const events: string[] = [];
  const coordinator = {
    pull: jest.fn(async () => {
      events.push('pull');
      return stablePull();
    }),
    push: jest.fn(async () => {
      events.push('push');
      return idlePush();
    }),
  };
  const guestImportService = {
    getOffer: jest.fn(async () => {
      events.push('guest-offer');
      return {
        bookmarkCount: 1,
        noteCount: 0,
        highlightCount: 0,
        totalCount: 1,
      };
    }),
    merge: jest.fn(),
    keepSeparate: jest.fn(),
  };
  const database = {
    getSyncStatus: jest.fn(async () => ({
      lastSuccessfulSyncAt: 5000,
      pendingCount: 0,
      conflictCount: 0,
    })),
  };
  const lifecycle = new QfSyncLifecycle({
    enabled: true,
    coordinator,
    guestImportService,
    database,
    getSession: jest.fn(async () => session()),
    onSessionRevoked: jest.fn(async () => undefined),
    flushReadingSession: jest.fn(async () => undefined),
    now: () => 6000,
    ...overrides,
  });
  return {lifecycle, coordinator, guestImportService, database, events};
}

beforeEach(() => {
  jest.restoreAllMocks();
  useQfSyncStore.getState().resetForTesting();
});

describe('QfSyncLifecycle', () => {
  it('keeps the active account usable offline and prompts only after a stable pull', async () => {
    const {lifecycle, coordinator, guestImportService, events} =
      createLifecycle();

    lifecycle.updateContext({...authenticatedOnline, online: false});
    await lifecycle.waitForIdle();
    expect(useQfSyncStore.getState()).toMatchObject({
      activeAccountId: 'account-a',
      status: 'offline',
    });
    expect(coordinator.pull).not.toHaveBeenCalled();

    lifecycle.updateContext(authenticatedOnline);
    await lifecycle.waitForIdle();
    expect(events).toEqual(['pull', 'guest-offer', 'push']);
    expect(guestImportService.getOffer).toHaveBeenCalledWith('account-a');
    expect(useQfSyncStore.getState().guestMergePrompt).toEqual({
      accountId: 'account-a',
      bookmarkCount: 1,
      noteCount: 0,
      highlightCount: 0,
      totalCount: 1,
      submitting: false,
    });
    expect(useQfSyncStore.getState()).toMatchObject({
      status: 'idle',
      lastSuccessAt: 5000,
    });
  });

  it('does not offer guest merge when the initial pull is unstable', async () => {
    const coordinator = {
      pull: jest.fn(async () => ({
        status: 'deferred' as const,
        reason: 'unstable_head' as const,
        retryAfterMs: 250,
        restarts: 2,
      })),
      push: jest.fn(),
    };
    const {lifecycle, guestImportService} = createLifecycle({coordinator});

    lifecycle.updateContext(authenticatedOnline);
    await lifecycle.waitForIdle();
    expect(guestImportService.getOffer).not.toHaveBeenCalled();
    expect(coordinator.push).not.toHaveBeenCalled();
    expect(useQfSyncStore.getState()).toMatchObject({
      status: 'retry',
      errorCode: 'unstable_head',
    });
  });

  it('stops the old account after its current pull and isolates A-to-B-to-A views', async () => {
    let finishPull: (value: ReturnType<typeof stablePull>) => void = () =>
      undefined;
    const coordinator = {
      pull: jest.fn(
        () =>
          new Promise<ReturnType<typeof stablePull>>(resolve => {
            finishPull = resolve;
          }),
      ),
      push: jest.fn(async () => idlePush()),
    };
    const flushReadingSession = jest.fn(async () => undefined);
    const {lifecycle} = createLifecycle({coordinator, flushReadingSession});

    lifecycle.updateContext(authenticatedOnline);
    await Promise.resolve();
    lifecycle.updateContext({
      authStatus: 'signed_out',
      accountId: null,
      online: true,
      appActive: true,
    });
    expect(useQfSyncStore.getState()).toMatchObject({
      activeAccountId: null,
      status: 'signed_out',
    });
    finishPull(stablePull());
    await lifecycle.waitForIdle();
    expect(coordinator.push).not.toHaveBeenCalled();
    expect(flushReadingSession).toHaveBeenCalled();

    lifecycle.updateContext({
      authStatus: 'authenticated',
      accountId: 'account-b',
      online: false,
      appActive: true,
    });
    await lifecycle.waitForIdle();
    expect(useQfSyncStore.getState().activeAccountId).toBe('account-b');
    lifecycle.updateContext({
      authStatus: 'authenticated',
      accountId: 'account-a',
      online: false,
      appActive: true,
    });
    await lifecycle.waitForIdle();
    expect(useQfSyncStore.getState()).toMatchObject({
      activeAccountId: 'account-a',
      status: 'offline',
    });
    expect(useQfSyncStore.getState().guestMergePrompt).toBeNull();
  });

  it('starts the new online account after an old-account pull finishes', async () => {
    let finishAccountAPull: (
      value: ReturnType<typeof stablePull>,
    ) => void = () => undefined;
    const coordinator = {
      pull: jest.fn(({accountId}: {accountId: string}) => {
        if (accountId === 'account-a') {
          return new Promise<ReturnType<typeof stablePull>>(resolve => {
            finishAccountAPull = resolve;
          });
        }
        return Promise.resolve(stablePull());
      }),
      push: jest.fn(async () => idlePush()),
    };
    const getSession = jest.fn(async () => {
      const accountId = useQfSyncStore.getState().activeAccountId;
      return session(accountId ?? 'account-a');
    });
    const {lifecycle} = createLifecycle({coordinator, getSession});

    lifecycle.updateContext(authenticatedOnline);
    await Promise.resolve();
    lifecycle.updateContext({...authenticatedOnline, accountId: 'account-b'});
    finishAccountAPull(stablePull());
    await lifecycle.waitForIdle();

    expect(
      coordinator.pull.mock.calls.map(([input]) => input.accountId),
    ).toEqual(['account-a', 'account-b']);
    expect(coordinator.push).toHaveBeenCalledTimes(1);
    expect(coordinator.push).toHaveBeenCalledWith(
      expect.objectContaining({accountId: 'account-b'}),
    );
    expect(useQfSyncStore.getState()).toMatchObject({
      activeAccountId: 'account-b',
      status: 'idle',
    });
  });

  it('retains durable work across stop and runs pull-first on reconnect', async () => {
    const {lifecycle, coordinator} = createLifecycle();
    lifecycle.updateContext({...authenticatedOnline, online: false});
    await lifecycle.stop();
    expect(coordinator.pull).not.toHaveBeenCalled();

    const restarted = createLifecycle();
    restarted.lifecycle.updateContext(authenticatedOnline);
    await restarted.lifecycle.waitForIdle();
    expect(restarted.events.slice(0, 2)).toEqual(['pull', 'guest-offer']);
    expect(restarted.events.at(-1)).toBe('push');
  });

  it('honors the kill switch even when authenticated and online', async () => {
    const getSession = jest.fn(async () => session());
    const {lifecycle, coordinator} = createLifecycle({
      enabled: false,
      getSession,
    });
    lifecycle.updateContext(authenticatedOnline);
    await lifecycle.waitForIdle();
    expect(getSession).not.toHaveBeenCalled();
    expect(coordinator.pull).not.toHaveBeenCalled();
    expect(coordinator.push).not.toHaveBeenCalled();
    expect(useQfSyncStore.getState()).toMatchObject({status: 'disabled'});
  });

  it('expires a revoked session without pushing or exposing raw error data', async () => {
    const coordinator = {
      pull: jest.fn(async () => {
        throw new BayaanSyncApiError('session_revoked', 401);
      }),
      push: jest.fn(),
    };
    const onSessionRevoked = jest.fn(async () => undefined);
    const {lifecycle} = createLifecycle({coordinator, onSessionRevoked});
    lifecycle.updateContext(authenticatedOnline);
    await lifecycle.waitForIdle();

    expect(onSessionRevoked).toHaveBeenCalledTimes(1);
    expect(coordinator.push).not.toHaveBeenCalled();
    expect(useQfSyncStore.getState()).toMatchObject({
      status: 'auth_expired',
      errorCode: 'session_revoked',
    });
    expect(Object.keys(useQfSyncStore.getState().diagnostics).sort()).toEqual([
      'ambiguousCount',
      'conflictCount',
      'durationMs',
      'errorCode',
      'httpClass',
      'pendingCount',
      'pushedCount',
    ]);
    expect(useQfSyncStore.getState().diagnostics).toMatchObject({
      httpClass: '4xx',
      errorCode: 'session_revoked',
    });

    lifecycle.updateContext({
      authStatus: 'signed_out',
      accountId: null,
      online: true,
      appActive: true,
    });
    expect(useQfSyncStore.getState()).toMatchObject({
      activeAccountId: null,
      status: 'auth_expired',
      errorCode: 'session_revoked',
    });
    expect(useQfSyncStore.getState().diagnostics.errorCode).toBe(
      'session_revoked',
    );
  });

  it('surfaces conflict and allows an explicit retry', async () => {
    const coordinator = {
      pull: jest.fn(async () => stablePull()),
      push: jest
        .fn()
        .mockResolvedValueOnce({
          status: 'deferred',
          reason: 'conflict',
          retryAfterMs: 250,
        })
        .mockResolvedValueOnce(idlePush()),
    };
    const {lifecycle} = createLifecycle({coordinator});
    lifecycle.updateContext(authenticatedOnline);
    await lifecycle.waitForIdle();
    expect(useQfSyncStore.getState()).toMatchObject({
      status: 'conflict',
      errorCode: 'conflict',
    });

    lifecycle.retryNow();
    await lifecycle.waitForIdle();
    expect(coordinator.pull).toHaveBeenCalledTimes(2);
    expect(coordinator.push).toHaveBeenCalledTimes(2);
    expect(useQfSyncStore.getState().status).toBe('idle');
  });
});

describe('QfReadingSessionService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces only the latest first-visible verse and excludes local metadata', async () => {
    let now = 1000;
    const database = {upsertReadingLocation: jest.fn(async () => undefined)};
    const service = new QfReadingSessionService({
      database,
      now: () => ++now,
      getActiveAccountId: () => 'account-a',
      requestSync: jest.fn(),
    });

    service.recordVisibleVerse('2:255');
    service.recordVisibleVerse('3:7');
    expect(database.upsertReadingLocation).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(READING_SESSION_DEBOUNCE_MS);

    expect(database.upsertReadingLocation).toHaveBeenCalledTimes(1);
    expect(database.upsertReadingLocation).toHaveBeenCalledWith({
      accountId: 'account-a',
      verseKey: '3:7',
      surahNumber: 3,
      ayahNumber: 7,
      lastReadAt: 1002,
    });
    expect(
      JSON.stringify(
        (database.upsertReadingLocation as jest.Mock).mock.calls[0][0],
      ),
    ).not.toMatch(/page|rewayah|duration|scroll|analytics|audio/i);
  });

  it('keeps guest reading usable and flushes old-account work on switch', async () => {
    let activeAccountId: string | null = null;
    const database = {upsertReadingLocation: jest.fn(async () => undefined)};
    const requestSync = jest.fn();
    const service = new QfReadingSessionService({
      database,
      now: () => 2000,
      getActiveAccountId: () => activeAccountId,
      requestSync,
    });

    service.recordVisibleVerse('2:255');
    await jest.advanceTimersByTimeAsync(READING_SESSION_DEBOUNCE_MS);
    expect(database.upsertReadingLocation).not.toHaveBeenCalled();

    activeAccountId = 'account-a';
    service.recordVisibleVerse('18:10');
    activeAccountId = 'account-b';
    await service.flush('account-a');
    expect(database.upsertReadingLocation).toHaveBeenCalledWith({
      accountId: 'account-a',
      verseKey: '18:10',
      surahNumber: 18,
      ayahNumber: 10,
      lastReadAt: 2000,
    });
    expect(requestSync).toHaveBeenCalledTimes(1);
  });
});

describe('VerseAnnotationService active scope', () => {
  it('keeps guest writes local and queues authenticated offline writes in only that account', async () => {
    const guestAdd = jest
      .spyOn(verseAnnotationDatabaseService, 'addBookmark')
      .mockResolvedValue({
        id: 'guest-bookmark',
        ownerScope: 'guest',
        verseKey: '2:255',
        surahNumber: 2,
        ayahNumber: 255,
        createdAt: 1000,
        rewayahId: 'hafs',
      });
    const accountAdd = jest
      .spyOn(qfSyncDatabaseService, 'addBookmark')
      .mockResolvedValue({
        id: 'account-bookmark',
        ownerScope: 'qf:account-a',
        verseKey: '3:7',
        surahNumber: 3,
        ayahNumber: 7,
        createdAt: 1001,
        rewayahId: 'hafs',
      });

    await verseAnnotationService.addBookmark('2:255', 2, 255, 'hafs');
    expect(guestAdd).toHaveBeenCalledWith('2:255', 2, 255, 'hafs');
    expect(accountAdd).not.toHaveBeenCalled();
    expect(useQfSyncStore.getState().syncRequestId).toBe(0);

    useQfSyncStore.setState({activeAccountId: 'account-a', status: 'offline'});
    await verseAnnotationService.addBookmark('3:7', 3, 7, 'hafs');
    expect(accountAdd).toHaveBeenCalledWith({
      accountId: 'account-a',
      verseKey: '3:7',
      surahNumber: 3,
      ayahNumber: 7,
      rewayahId: 'hafs',
    });
    expect(useQfSyncStore.getState().syncRequestId).toBe(1);
  });

  it('queries only the currently active A-to-B-to-guest scope', async () => {
    const getBookmarks = jest
      .spyOn(verseAnnotationDatabaseService, 'getAllBookmarksInOwnerScope')
      .mockResolvedValue([]);

    useQfSyncStore.setState({activeAccountId: 'account-a'});
    await verseAnnotationService.getAllBookmarks();
    useQfSyncStore.setState({activeAccountId: 'account-b'});
    await verseAnnotationService.getAllBookmarks();
    useQfSyncStore.setState({activeAccountId: null});
    await verseAnnotationService.getAllBookmarks();

    expect(getBookmarks.mock.calls.map(([scope]) => scope)).toEqual([
      'qf:account-a',
      'qf:account-b',
      'guest',
    ]);
  });
});
