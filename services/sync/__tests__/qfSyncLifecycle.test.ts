jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  atQfSqliteBoundary,
  QfSqliteTransientError,
} from '@/services/sync/qfSqliteRetry';
import {BayaanSyncApiError} from '@/services/sync/bayaanSyncApiClient';
import {
  QfSyncLifecycle,
  qfSyncRemoteRetryDelayMs,
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
import {MushafSyncedReadingService} from '@/services/mushaf/MushafSyncedReadingService';
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {useVerseActions} from '@/hooks/useVerseActions';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';

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
      nextPendingAttemptAt: null,
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
    getReadingIntentRevision: jest.fn(() => 0),
    applyReadingProgress: jest.fn(async () => undefined),
    now: () => 6000,
    // Midpoint jitter: the first remote retry waits exactly 1000ms.
    random: () => 0.5,
    ...overrides,
  });
  return {lifecycle, coordinator, guestImportService, database, events};
}

beforeEach(() => {
  jest.restoreAllMocks();
  useQfSyncStore.getState().resetForTesting();
  useVerseAnnotationsStore.getState().clearActiveView();
});

// Source-controlled diagnostics from the installed Android binding, not device QA.
const androidLockDiagnostics = [5, 6].flatMap(code =>
  [
    'database is locked',
    'database table is locked',
    'database schema is locked',
  ].flatMap(message => {
    const raw = `Error code ${String.fromCharCode(code)}: ${message}`;
    return [
      raw,
      `Call to function 'NativeDatabase.execAsync' has been rejected.\n→ Caused by: ${raw}`,
      `Call to function 'NativeStatement.runAsync' has been rejected.\n→ Caused by: Error: ${raw}`,
    ];
  }),
);

// Largest Math.random() value in practice: delays land on the jitter ceiling.
const MAX_JITTER = 1 - 1e-9;

function manualTimers() {
  const pending = new Map<number, () => void>();
  const delays: number[] = [];
  let nextId = 1;
  return {
    delays,
    live: () => pending.size,
    // Fires the single pending timer; more than one means stacked timers.
    async fireOnly(): Promise<void> {
      expect(pending.size).toBe(1);
      const [[id, callback]] = [...pending];
      pending.delete(id);
      callback();
    },
    options: {
      setTimer: (callback: () => void, delayMs: number) => {
        const id = nextId;
        nextId += 1;
        pending.set(id, callback);
        delays.push(delayMs);
        return id as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: (timer: ReturnType<typeof setTimeout>) => {
        pending.delete(timer as unknown as number);
      },
    },
  };
}

describe('qfSyncRemoteRetryDelayMs', () => {
  it('keeps full-jitter delays between the 1s floor and a 2s-doubling ceiling capped at 5 minutes', () => {
    for (let failures = 0; failures <= 40; failures += 1) {
      const ceiling = Math.min(300_000, 2000 * 2 ** failures);
      for (const sample of [0, 0.1, 0.5, 0.9, MAX_JITTER]) {
        const delay = qfSyncRemoteRetryDelayMs(failures, () => sample);
        expect(delay).toBeGreaterThanOrEqual(1000);
        expect(delay).toBeLessThan(ceiling);
        expect(delay).toBe(Math.max(1000, Math.floor(sample * ceiling)));
      }
    }
  });

  it('never retries sooner than a provided Retry-After', () => {
    expect(qfSyncRemoteRetryDelayMs(0, () => 0, 45_000)).toBe(45_000);
    expect(qfSyncRemoteRetryDelayMs(20, () => MAX_JITTER, 3_600_000)).toBe(
      3_600_000,
    );
    expect(qfSyncRemoteRetryDelayMs(4, () => 0.5, 1000)).toBe(16_000);
  });
});

describe('QfSyncLifecycle', () => {
  it.each([
    ...[
      5,
      6,
      'SQLITE_BUSY',
      'SQLITE_LOCKED',
      'ERR_INTERNAL_SQLITE_ERROR',
      undefined,
    ].map(code => ({code, message: 'database is locked'})),
    ...androidLockDiagnostics.map(message => ({
      code: 'ERR_INTERNAL_SQLITE_ERROR',
      message,
    })),
  ])(
    'known SQLite lock (%s) retries at exactly 1000ms without relogin or permanent annotation barrier',
    async ({code, message}) => {
      jest.useFakeTimers();
      jest.setSystemTime(6000);
      try {
        const original = Object.assign(
          new Error(message),
          code === undefined ? {} : {code},
        );
        const locked = await atQfSqliteBoundary(async () => {
          throw original;
        }).catch(error => error);
        expect(locked).toBeInstanceOf(QfSqliteTransientError);
        expect(locked.cause).toBe(original);
        const coordinator = {
          pull: jest
            .fn()
            .mockRejectedValueOnce(locked)
            .mockResolvedValue(stablePull()),
          push: jest.fn().mockResolvedValue(idlePush()),
        };
        const {lifecycle} = createLifecycle({
          coordinator,
          now: () => Date.now(),
        });
        lifecycle.updateContext(authenticatedOnline);
        await lifecycle.waitForIdle();
        expect(useQfSyncStore.getState()).toMatchObject({
          status: 'retry',
          retryAt: 7000,
          errorCode: 'local_sqlite_locked',
        });
        await jest.advanceTimersByTimeAsync(999);
        expect(coordinator.pull).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(1);
        await lifecycle.waitForIdle();
        expect(coordinator.pull).toHaveBeenCalledTimes(2);
        expect(useQfSyncStore.getState().status).toBe('idle');
        lifecycle.requestSync();
        await lifecycle.waitForIdle();
        expect(coordinator.pull).toHaveBeenCalledTimes(3);
        await lifecycle.stop();
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it.each(
    (['offline', 'logout', 'account-switch'] as const).flatMap(mode =>
      ['database is locked', ...androidLockDiagnostics].map(message => ({
        mode,
        message,
      })),
    ),
  )(
    'cancels a known-lock timer on %s and ignores stale callbacks',
    async ({mode, message}) => {
      let callback: () => void = () => undefined;
      const clearTimer = jest.fn();
      const locked = await atQfSqliteBoundary(async () => {
        throw Object.assign(new Error(message), {
          code: 'ERR_INTERNAL_SQLITE_ERROR',
        });
      }).catch(error => error);
      const coordinator = {
        pull: jest.fn().mockRejectedValue(locked),
        push: jest.fn(),
      };
      const {lifecycle} = createLifecycle({
        coordinator,
        clearTimer,
        setTimer: (task: () => void) => {
          callback = task;
          return 42;
        },
      });
      lifecycle.updateContext(authenticatedOnline);
      await lifecycle.waitForIdle();
      lifecycle.updateContext(
        mode === 'offline'
          ? {...authenticatedOnline, online: false}
          : mode === 'logout'
            ? {
                ...authenticatedOnline,
                authStatus: 'signed_out',
                accountId: null,
              }
            : {...authenticatedOnline, accountId: 'account-b', online: false},
      );
      callback();
      await lifecycle.waitForIdle();
      expect(clearTimer).toHaveBeenCalled();
      expect(coordinator.pull).toHaveBeenCalledTimes(1);
      await lifecycle.stop();
    },
  );

  it.each([
    new Error('service busy, retry later'),
    new Error('account locked'),
    Object.assign(new Error('database is locked'), {code: 19}),
    new Error('database is locked plus secret SQL'),
    new Error('Error code \u0007: database is locked'),
    new Error('Error code 19: database is locked'),
    new Error('Error code \u0005: service busy, retry later'),
    new Error('Error code \u0006: account locked'),
    new Error('Error code \u0005: database is locked' + 'x'.repeat(257)),
    Object.assign(new Error('Error code \u0005: database is locked'), {
      code: 19,
    }),
    new Error(
      "Call to function 'OtherService.runAsync' has been rejected.\n→ Caused by: Error code \u0005: database is locked",
    ),
    new BayaanSyncApiError('invalid_response', 200),
  ])('unknown/permanent errors do not become SQLite retryable', async error => {
    const boundaryError = await atQfSqliteBoundary(async () => {
      throw error;
    }).catch(caught => caught);
    expect(boundaryError).toBe(error);
    const setTimer = jest.fn();
    const coordinator = {
      pull: jest.fn().mockRejectedValue(error),
      push: jest.fn(),
    };
    const {lifecycle} = createLifecycle({coordinator, setTimer});
    lifecycle.updateContext(authenticatedOnline);
    await lifecycle.waitForIdle();
    lifecycle.requestSync();
    await lifecycle.waitForIdle();
    expect(coordinator.pull).toHaveBeenCalledTimes(1);
    expect(setTimer).not.toHaveBeenCalled();
    expect(useQfSyncStore.getState().retryAt).toBeNull();
    await lifecycle.stop();
  });
  it.each([400, 403, 404, 413, 422, 408, 409, 429, 500, 503, 0])(
    'only schedules retryable HTTP failures (%s)',
    async status => {
      const setTimer = jest.fn(
        () => 42 as unknown as ReturnType<typeof setTimeout>,
      );
      const coordinator = {
        pull: jest.fn(async () => {
          throw new BayaanSyncApiError('request_failed', status);
        }),
        push: jest.fn(),
      };
      const {lifecycle} = createLifecycle({coordinator, setTimer});
      lifecycle.updateContext(authenticatedOnline);
      await lifecycle.waitForIdle();
      const retryable = [0, 408, 409, 429, 500, 503].includes(status);
      expect(setTimer).toHaveBeenCalledTimes(retryable ? 1 : 0);
      expect(useQfSyncStore.getState().retryAt).toBe(retryable ? 7000 : null);
      if (!retryable) {
        const calls = coordinator.pull.mock.calls.length;
        lifecycle.requestSync();
        await lifecycle.waitForIdle();
        expect(coordinator.pull).toHaveBeenCalledTimes(calls); // Annotation writes cannot spin permanent errors.
        lifecycle.updateContext({...authenticatedOnline, appActive: false});
        lifecycle.updateContext(authenticatedOnline);
        await lifecycle.waitForIdle();
        expect(coordinator.pull).toHaveBeenCalledTimes(calls + 1);
      }
      await lifecycle.stop();
    },
  );
  it('honors provider Retry-After rather than retrying a rate limit every second', async () => {
    const setTimer = jest.fn(
      () => 42 as unknown as ReturnType<typeof setTimeout>,
    );
    const coordinator = {
      pull: jest.fn(async () => {
        throw new BayaanSyncApiError('rate_limited', 429, 45_000);
      }),
      push: jest.fn(),
    };
    const {lifecycle} = createLifecycle({coordinator, setTimer});
    lifecycle.updateContext(authenticatedOnline);
    await lifecycle.waitForIdle();
    expect(setTimer).toHaveBeenCalledWith(expect.any(Function), 45_000);
    expect(useQfSyncStore.getState().retryAt).toBe(51_000);
    await lifecycle.stop();
  });

  it('backs off consecutive upstream failures up to the cap and resets after a successful sync', async () => {
    const timers = manualTimers();
    let failing = true;
    const coordinator = {
      pull: jest.fn(async () => {
        if (failing) {
          throw new BayaanSyncApiError('service_unavailable', 503);
        }
        return stablePull();
      }),
      push: jest.fn(async () => idlePush()),
    };
    const {lifecycle} = createLifecycle({
      coordinator,
      random: () => MAX_JITTER,
      ...timers.options,
    });
    lifecycle.updateContext(authenticatedOnline);
    await lifecycle.waitForIdle();
    for (let fired = 0; fired < 9; fired += 1) {
      await timers.fireOnly();
      await lifecycle.waitForIdle();
    }
    expect(timers.delays).toEqual([
      1999, 3999, 7999, 15_999, 31_999, 63_999, 127_999, 255_999, 299_999,
      299_999,
    ]);
    expect(useQfSyncStore.getState().retryAt).toBe(6000 + 299_999);

    failing = false;
    await timers.fireOnly();
    await lifecycle.waitForIdle();
    expect(useQfSyncStore.getState()).toMatchObject({
      status: 'idle',
      retryAt: null,
    });
    expect(timers.live()).toBe(0);

    failing = true;
    lifecycle.requestSync();
    await lifecycle.waitForIdle();
    expect(timers.delays.at(-1)).toBe(1999);
    await lifecycle.stop();
  });

  it('waits at least a later Retry-After than the backoff for 503 and 429', async () => {
    const timers = manualTimers();
    const coordinator = {
      pull: jest
        .fn()
        .mockRejectedValueOnce(
          new BayaanSyncApiError('service_unavailable', 503, 30_000),
        )
        .mockRejectedValueOnce(
          new BayaanSyncApiError('rate_limited', 429, 600_000),
        )
        .mockRejectedValueOnce(new BayaanSyncApiError('rate_limited', 429, 1)),
      push: jest.fn(),
    };
    const {lifecycle} = createLifecycle({coordinator, ...timers.options});
    lifecycle.updateContext(authenticatedOnline);
    await lifecycle.waitForIdle();
    await timers.fireOnly();
    await lifecycle.waitForIdle();
    await timers.fireOnly();
    await lifecycle.waitForIdle();
    // Retry-After wins when longer, even beyond the backoff cap; otherwise the
    // backoff (third failure, midpoint jitter of 8000ms) still applies.
    expect(timers.delays).toEqual([30_000, 600_000, 4000]);
    await lifecycle.stop();
  });

  it('lets a manual retry run immediately without stacking retry timers', async () => {
    const timers = manualTimers();
    let release: () => void = () => undefined;
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>(resolve => {
      markStarted = resolve;
    });
    const coordinator = {
      pull: jest
        .fn()
        .mockRejectedValueOnce(new BayaanSyncApiError('service_unavailable', 0))
        .mockRejectedValueOnce(new BayaanSyncApiError('service_unavailable', 0))
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              release = () =>
                reject(new BayaanSyncApiError('service_unavailable', 503));
              markStarted();
            }),
        )
        .mockRejectedValue(new BayaanSyncApiError('service_unavailable', 503)),
      push: jest.fn(),
    };
    const {lifecycle} = createLifecycle({
      coordinator,
      random: () => MAX_JITTER,
      ...timers.options,
    });
    lifecycle.updateContext(authenticatedOnline);
    await lifecycle.waitForIdle();
    expect(timers.live()).toBe(1);

    // Retry while a timer is pending: the timer is replaced, not duplicated,
    // and the backoff keeps growing across the manual attempt.
    lifecycle.retryNow();
    await lifecycle.waitForIdle();
    expect(coordinator.pull).toHaveBeenCalledTimes(2);
    expect(timers.live()).toBe(1);
    expect(timers.delays).toEqual([1999, 3999]);

    // Retry while a run is in flight: one rerun, still one timer afterwards.
    lifecycle.retryNow();
    expect(timers.live()).toBe(0);
    lifecycle.retryNow();
    await started;
    release();
    await lifecycle.waitForIdle();
    expect(coordinator.pull).toHaveBeenCalledTimes(4);
    expect(timers.live()).toBe(1);

    // Foregrounding also attempts immediately and leaves a single timer.
    lifecycle.updateContext({...authenticatedOnline, appActive: false});
    expect(timers.live()).toBe(0);
    lifecycle.updateContext(authenticatedOnline);
    await lifecycle.waitForIdle();
    expect(coordinator.pull).toHaveBeenCalledTimes(5);
    expect(timers.live()).toBe(1);
    await lifecycle.stop();
  });

  it('applies canonical reading progress after a stable pull before publishing the data revision', async () => {
    let appliedPage: number | null = null;
    let revisionWhenApplied: number | null = null;
    const applyReadingProgress = jest.fn(async () => {
      appliedPage = 293;
      revisionWhenApplied = useQfSyncStore.getState().dataRevision;
    });
    const {lifecycle} = createLifecycle({applyReadingProgress});

    lifecycle.updateContext(authenticatedOnline);
    await lifecycle.waitForIdle();

    expect(appliedPage).toBe(293);
    expect(revisionWhenApplied).toBe(0);
    expect(useQfSyncStore.getState().dataRevision).toBe(1);
  });

  it('flushes pending reading intent before pull and guards post-pull application with its revision', async () => {
    const events: string[] = [];
    let localIntentRevision = 3;
    let finishPull: (value: ReturnType<typeof stablePull>) => void = () =>
      undefined;
    const coordinator = {
      pull: jest.fn(
        () =>
          new Promise<ReturnType<typeof stablePull>>(resolve => {
            events.push('pull');
            finishPull = resolve;
          }),
      ),
      push: jest.fn(async () => idlePush()),
    };
    const flushReadingSession = jest.fn(async (accountId?: string) => {
      events.push(`flush:${accountId ?? 'guest'}`);
    });
    const applyReadingProgress = jest.fn(
      async (_accountId: string, expectedRevision: number) => {
        events.push(`apply:${expectedRevision}:${localIntentRevision}`);
      },
    );
    const {lifecycle} = createLifecycle({
      coordinator,
      flushReadingSession,
      getReadingIntentRevision: () => localIntentRevision,
      applyReadingProgress,
    });

    lifecycle.updateContext(authenticatedOnline);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(events).toEqual(['flush:guest', 'flush:account-a', 'pull']);

    localIntentRevision = 4;
    finishPull(stablePull());
    await lifecycle.waitForIdle();

    expect(flushReadingSession).toHaveBeenCalledWith('account-a');
    expect(applyReadingProgress).toHaveBeenCalledWith('account-a', 3);
    expect(events).toContain('apply:3:4');
  });

  it('prevents a newer visible verse recorded during the real pre-pull flush from being overwritten by stale canonical progress', async () => {
    let finishFirstWrite: () => void = () => undefined;
    let announceFirstWrite: () => void = () => undefined;
    const firstWriteStarted = new Promise<void>(resolve => {
      announceFirstWrite = resolve;
    });
    const firstWriteBlocked = new Promise<void>(resolve => {
      finishFirstWrite = resolve;
    });
    let canonicalVerse = '1:1';
    let writeCount = 0;
    const database = {
      upsertReadingLocation: jest.fn(async input => {
        writeCount += 1;
        if (writeCount === 1) {
          announceFirstWrite();
          await firstWriteBlocked;
        }
        canonicalVerse = input.verseKey;
      }),
      getLatestReadingLocation: jest.fn(async () => ({
        id: 'canonical-reading',
        ownerScope: 'qf:account-a' as const,
        verseKey: canonicalVerse,
        surahNumber: Number(canonicalVerse.split(':')[0]),
        ayahNumber: Number(canonicalVerse.split(':')[1]),
        lastReadAt: 1_000,
        createdAt: 1_000,
        updatedAt: 1_000,
      })),
    };
    const readingService = new QfReadingSessionService({
      database,
      getActiveAccountId: () => 'account-a',
      requestSync: jest.fn(),
      debounceMs: 60_000,
    });
    const setLastReadPageFromSync = jest.fn();
    const syncedReadingService = new MushafSyncedReadingService({
      database,
      resolveVersePage: async verseKey => (verseKey === '2:255' ? 42 : 50),
      getLocalIntentRevision: accountId =>
        readingService.getIntentRevision(accountId),
      getLastReadPageUpdatedAt: () => null,
      setLastReadPageFromSync,
    });
    let releaseHandoff: () => void = () => undefined;
    const handoff = new Promise<void>(resolve => {
      releaseHandoff = resolve;
    });
    const {lifecycle} = createLifecycle({
      beginAnnotationScopeHandoff: () => handoff,
      flushReadingSession: (accountId?: string) =>
        readingService.flush(accountId),
      getReadingIntentRevision: (accountId: string) =>
        readingService.getIntentRevision(accountId),
      applyReadingProgress: (accountId: string, expectedRevision: number) =>
        syncedReadingService.applyCanonicalForAccount(
          accountId,
          expectedRevision,
        ),
    });

    lifecycle.updateContext(authenticatedOnline);
    readingService.recordVisibleVerse('2:255');
    releaseHandoff();
    await firstWriteStarted;

    readingService.recordVisibleVerse('3:7');
    finishFirstWrite();
    await lifecycle.waitForIdle();

    expect(setLastReadPageFromSync).not.toHaveBeenCalled();
    await readingService.flush('account-a');
  });

  it('keeps an otherwise successful sync cycle healthy when synced reading progress is unresolvable', async () => {
    const {lifecycle} = createLifecycle({
      applyReadingProgress: async () => {
        throw new Error('unresolvable verse');
      },
    });

    lifecycle.updateContext(authenticatedOnline);
    await lifecycle.waitForIdle();

    expect(useQfSyncStore.getState()).toMatchObject({
      status: 'idle',
      lastSuccessAt: 5000,
    });
  });

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
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(coordinator.pull).toHaveBeenCalledTimes(1);
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

  it('schedules the earliest durable pending retry after an idle push', async () => {
    const setTimer = jest.fn(
      () => 42 as unknown as ReturnType<typeof setTimeout>,
    );
    const database = {
      getSyncStatus: jest.fn(async () => ({
        lastSuccessfulSyncAt: 5000,
        pendingCount: 1,
        conflictCount: 0,
        nextPendingAttemptAt: 6500,
      })),
    };
    const {lifecycle} = createLifecycle({database, setTimer});

    lifecycle.updateContext(authenticatedOnline);
    await lifecycle.waitForIdle();

    expect(setTimer).toHaveBeenCalledTimes(1);
    expect(setTimer).toHaveBeenCalledWith(expect.any(Function), 500);
    expect(useQfSyncStore.getState()).toMatchObject({
      status: 'retry',
      retryAt: 6500,
      errorCode: 'pending_retry',
    });
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
    expect(useQfSyncStore.getState()).toMatchObject({
      status: 'disabled',
      activeAccountId: null,
    });
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

  it('continues a newer debounced page after an earlier held database write rejects', async () => {
    let reject!: (error: Error) => void;
    const database = {upsertReadingLocation: jest.fn(async () => undefined)};
    database.upsertReadingLocation.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const requestSync = jest.fn();
    const service = new QfReadingSessionService({
      database,
      getActiveAccountId: () => 'account-a',
      requestSync,
    });
    service.recordPageIntent('2:255', 1000);
    await jest.advanceTimersByTimeAsync(READING_SESSION_DEBOUNCE_MS);
    service.recordPageIntent('3:7', 2000);
    await jest.advanceTimersByTimeAsync(READING_SESSION_DEBOUNCE_MS);
    reject(new Error('disk held/failed'));
    await jest.advanceTimersByTimeAsync(0);
    await service.flush('account-a');
    expect(database.upsertReadingLocation).toHaveBeenCalledTimes(2);
    expect(database.upsertReadingLocation).toHaveBeenLastCalledWith({
      accountId: 'account-a',
      verseKey: '3:7',
      surahNumber: 3,
      ayahNumber: 7,
      lastReadAt: 2000,
    });
    expect(requestSync).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
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

  it('increments the account-local intent revision for every accepted visible verse', () => {
    const service = new QfReadingSessionService({
      database: {upsertReadingLocation: jest.fn(async () => undefined)},
      getActiveAccountId: () => 'account-a',
      requestSync: jest.fn(),
    });

    expect(service.getIntentRevision('account-a')).toBe(0);
    service.recordVisibleVerse('2:255');
    expect(service.getIntentRevision('account-a')).toBe(1);
    service.recordVisibleVerse('3:7');
    expect(service.getIntentRevision('account-a')).toBe(2);
    service.recordVisibleVerse('not-a-verse');
    expect(service.getIntentRevision('account-a')).toBe(2);
  });

  it('advances local page intent without enqueueing when verse mapping is unavailable', async () => {
    const database = {upsertReadingLocation: jest.fn(async () => undefined)};
    const service = new QfReadingSessionService({
      database,
      getActiveAccountId: () => 'account-a',
      requestSync: jest.fn(),
    });

    service.recordPageIntent();
    await jest.advanceTimersByTimeAsync(READING_SESSION_DEBOUNCE_MS);

    expect(service.getIntentRevision('account-a')).toBe(1);
    expect(database.upsertReadingLocation).not.toHaveBeenCalled();
  });

  it('uses the persistent local page timestamp for the queued reading location', async () => {
    const database = {upsertReadingLocation: jest.fn(async () => undefined)};
    const service = new QfReadingSessionService({
      database,
      now: () => 9_999,
      getActiveAccountId: () => 'account-a',
      requestSync: jest.fn(),
    });

    service.recordPageIntent('2:255', 1_234);
    await jest.advanceTimersByTimeAsync(READING_SESSION_DEBOUNCE_MS);

    expect(database.upsertReadingLocation).toHaveBeenCalledWith(
      expect.objectContaining({lastReadAt: 1_234}),
    );
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
  it('quiesces a paused account write and rejects its stale post-await view update on switch', async () => {
    jest
      .spyOn(verseAnnotationDatabaseService, 'isBookmarkedInOwnerScope')
      .mockResolvedValue(false);
    let finishWrite: (value: {
      id: string;
      ownerScope: 'qf:account-a';
      verseKey: string;
      surahNumber: number;
      ayahNumber: number;
      createdAt: number;
      rewayahId: 'hafs';
    }) => void = () => undefined;
    const accountAdd = jest
      .spyOn(qfSyncDatabaseService, 'addBookmark')
      .mockImplementation(
        () =>
          new Promise(resolve => {
            finishWrite = resolve;
          }),
      );
    let actions: ReturnType<typeof useVerseActions> | null = null;
    function ActionsHarness() {
      actions = useVerseActions();
      return null;
    }
    let screen: renderer.ReactTestRenderer | null = null;
    await act(async () => {
      screen = renderer.create(React.createElement(ActionsHarness) as never);
    });
    const {lifecycle} = createLifecycle();
    lifecycle.updateContext({...authenticatedOnline, online: false});
    await lifecycle.waitForIdle();
    const capturedActions = actions as ReturnType<
      typeof useVerseActions
    > | null;
    if (!capturedActions) throw new Error('verse actions hook did not render');

    let write: Promise<void> = Promise.resolve();
    await act(async () => {
      write = capturedActions.toggleBookmark('2:255', 2, 255);
      await Promise.resolve();
    });
    lifecycle.updateContext({
      ...authenticatedOnline,
      accountId: 'account-b',
      online: false,
    });
    let handoffFinished = false;
    const handoff = lifecycle.waitForIdle().then(() => {
      handoffFinished = true;
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(handoffFinished).toBe(false);
    finishWrite({
      id: 'account-a-bookmark',
      ownerScope: 'qf:account-a',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      createdAt: 7001,
      rewayahId: 'hafs',
    });
    await act(async () => {
      await write;
      await handoff;
    });

    expect(accountAdd).toHaveBeenCalledWith(
      expect.objectContaining({accountId: 'account-a'}),
    );
    expect(useVerseAnnotationsStore.getState().isBookmarked('2:255')).toBe(
      false,
    );
    await act(async () => {
      screen?.unmount();
    });
  });

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

  it('waits for the current account annotation transaction when stopped', async () => {
    let finishWrite: (value: {
      id: string;
      ownerScope: 'qf:account-a';
      verseKey: string;
      surahNumber: number;
      ayahNumber: number;
      createdAt: number;
      rewayahId: 'hafs';
    }) => void = () => undefined;
    jest.spyOn(qfSyncDatabaseService, 'addBookmark').mockImplementation(
      () =>
        new Promise(resolve => {
          finishWrite = resolve;
        }),
    );
    const {lifecycle} = createLifecycle();
    lifecycle.updateContext({...authenticatedOnline, online: false});
    await lifecycle.waitForIdle();

    const write = verseAnnotationService.addBookmark('2:255', 2, 255, 'hafs');
    await Promise.resolve();
    let stopped = false;
    const stop = lifecycle.stop().then(() => {
      stopped = true;
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(stopped).toBe(false);

    finishWrite({
      id: 'account-a-bookmark',
      ownerScope: 'qf:account-a',
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      createdAt: 7001,
      rewayahId: 'hafs',
    });
    await Promise.all([write, stop]);
    expect(stopped).toBe(true);
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
