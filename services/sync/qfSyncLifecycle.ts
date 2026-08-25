import {bayaanAuthConfig} from '@/config/bayaanAuth';
import {verseAnnotationDatabase} from '@/services/database/VerseAnnotationDatabase';
import {
  clearBayaanSession,
  getBayaanSession,
} from '@/services/auth/bayaanSessionStorage';
import {BayaanSyncApiClient, BayaanSyncApiError} from './bayaanSyncApiClient';
import {
  QfSyncCoordinator,
  SqliteQfSyncPullStore,
  type QfSyncPullResult,
  type QfSyncPushCoordinatorResult,
} from './qfSyncCoordinator';
import {
  qfGuestImportService,
  type QfGuestImportOffer,
} from './qfGuestImportService';
import {
  qfSyncDatabaseService,
  type QfSyncPersistedStatus,
} from './qfSyncDatabaseService';
import {qfReadingSessionService} from './qfReadingSessionService';
import {
  useBayaanAuthStore,
  type BayaanAuthStatus,
} from '@/store/bayaanAuthStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {
  EMPTY_QF_SYNC_DIAGNOSTICS,
  useQfSyncStore,
  type QfSyncDiagnostics,
  type QfSyncHttpClass,
  type QfSyncStatus,
} from '@/store/qfSyncStore';
import type {BayaanOpaqueSession} from '@/types/bayaan-auth';

const DEFAULT_RETRY_MS = 1000;

export interface QfSyncLifecycleContext {
  authStatus: BayaanAuthStatus;
  accountId: string | null;
  online: boolean;
  appActive: boolean;
}

interface LifecycleCoordinator {
  pull(input: {
    accountId: string;
    sessionToken: string;
  }): Promise<QfSyncPullResult>;
  push(input: {
    accountId: string;
    sessionToken: string;
  }): Promise<QfSyncPushCoordinatorResult>;
}

interface LifecycleGuestImportService {
  getOffer(accountId: string): Promise<QfGuestImportOffer | null>;
  merge(accountId: string): Promise<unknown>;
  keepSeparate(accountId: string): Promise<unknown>;
}

interface LifecycleDatabase {
  getSyncStatus(accountId: string): Promise<QfSyncPersistedStatus>;
}

interface QfSyncLifecycleOptions {
  enabled: boolean;
  coordinator: LifecycleCoordinator;
  guestImportService: LifecycleGuestImportService;
  database: LifecycleDatabase;
  getSession: () => Promise<BayaanOpaqueSession | null>;
  onSessionRevoked: () => Promise<void>;
  flushReadingSession: (accountId?: string) => Promise<void>;
  clearActiveViews?: () => void;
  now?: () => number;
  setTimer?: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

function activeAccount(context: QfSyncLifecycleContext | null): string | null {
  return context?.authStatus === 'authenticated' ? context.accountId : null;
}

function sameContext(
  left: QfSyncLifecycleContext | null,
  right: QfSyncLifecycleContext,
): boolean {
  return (
    left?.authStatus === right.authStatus &&
    left.accountId === right.accountId &&
    left.online === right.online &&
    left.appActive === right.appActive
  );
}

function httpClassForStatus(status: number): QfSyncHttpClass {
  if (status === 0) return 'network';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500) return '5xx';
  if (status >= 200 && status < 300) return '2xx';
  return 'none';
}

function emptyDiagnostics(
  overrides: Partial<QfSyncDiagnostics> = {},
): QfSyncDiagnostics {
  return {...EMPTY_QF_SYNC_DIAGNOSTICS, ...overrides};
}

function deferredStatus(reason: string): QfSyncStatus {
  return reason === 'conflict' ? 'conflict' : 'retry';
}

export class QfSyncLifecycle {
  private readonly now: () => number;
  private readonly setTimer: QfSyncLifecycleOptions['setTimer'];
  private readonly clearTimer: QfSyncLifecycleOptions['clearTimer'];
  private readonly clearActiveViews: () => void;
  private context: QfSyncLifecycleContext | null = null;
  private epoch = 0;
  private stopped = false;
  private currentRun: Promise<void> | null = null;
  private readonly maintenanceTasks = new Set<Promise<void>>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private rerunRequested = false;

  constructor(private readonly options: QfSyncLifecycleOptions) {
    this.now = options.now ?? Date.now;
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
    this.clearActiveViews =
      options.clearActiveViews ??
      (() => {
        const annotations = useVerseAnnotationsStore.getState();
        const loadedSurah = annotations.loadedSurah;
        annotations.clearActiveView();
        if (loadedSurah !== null) {
          useVerseAnnotationsStore
            .getState()
            .loadAnnotationsForSurah(loadedSurah)
            .catch(() => undefined);
        }
      });
  }

  updateContext(context: QfSyncLifecycleContext): void {
    if (sameContext(this.context, context) && !this.stopped) return;
    const previous = this.context;
    const previousAccount = activeAccount(previous);
    const nextAccount = activeAccount(context);
    this.stopped = false;
    this.context = context;
    this.epoch += 1;
    this.rerunRequested = false;
    this.cancelRetry();

    if (
      previousAccount !== nextAccount ||
      (previous?.appActive && !context.appActive)
    ) {
      this.trackMaintenance(
        this.options.flushReadingSession(previousAccount ?? undefined),
      );
    }

    if (previousAccount !== nextAccount) {
      const preserveAuthExpired =
        !nextAccount && useQfSyncStore.getState().status === 'auth_expired';
      useQfSyncStore.setState({
        activeAccountId: nextAccount,
        lastSuccessAt: null,
        retryAt: null,
        ...(preserveAuthExpired
          ? {}
          : {errorCode: null, diagnostics: emptyDiagnostics()}),
        guestMergePrompt: null,
      });
      this.clearActiveViews();
      if (nextAccount) {
        this.trackMaintenance(
          this.hydratePersistedStatus(nextAccount, this.epoch),
        );
      }
    }

    if (!this.options.enabled) {
      this.setAvailabilityStatus('disabled');
      return;
    }
    if (!nextAccount) {
      const currentStatus = useQfSyncStore.getState().status;
      if (currentStatus !== 'auth_expired') {
        this.setAvailabilityStatus('signed_out');
      }
      return;
    }
    if (!context.online) {
      this.setAvailabilityStatus('offline');
      return;
    }
    if (!context.appActive) {
      this.setAvailabilityStatus('idle');
      return;
    }
    this.requestSync();
  }

  requestSync(): void {
    if (!this.canRun()) return;
    if (this.currentRun) {
      this.rerunRequested = true;
      return;
    }
    const context = this.context;
    const accountId = activeAccount(context);
    if (!context || !accountId) return;
    const epoch = this.epoch;
    const run = this.runCycle(accountId, epoch);
    const wrapped = run.finally(() => {
      if (this.currentRun !== wrapped) return;
      this.currentRun = null;
      if (this.rerunRequested) {
        this.rerunRequested = false;
        this.requestSync();
      }
    });
    this.currentRun = wrapped;
  }

  retryNow(): void {
    this.cancelRetry();
    this.requestSync();
  }

  async resolveGuestDecision(
    decision: 'merge' | 'keep_separate',
  ): Promise<void> {
    const prompt = useQfSyncStore.getState().guestMergePrompt;
    const accountId = activeAccount(this.context);
    if (
      !prompt ||
      !accountId ||
      prompt.accountId !== accountId ||
      prompt.submitting
    ) {
      return;
    }
    useQfSyncStore.setState({
      guestMergePrompt: {...prompt, submitting: true},
    });
    try {
      if (decision === 'merge') {
        await this.options.guestImportService.merge(accountId);
      } else {
        await this.options.guestImportService.keepSeparate(accountId);
      }
      if (activeAccount(this.context) !== accountId) return;
      useQfSyncStore.setState({guestMergePrompt: null});
      if (decision === 'merge') {
        this.clearActiveViews();
        useQfSyncStore.getState().refreshData();
        this.requestSync();
      }
    } catch {
      if (activeAccount(this.context) !== accountId) return;
      const current = useQfSyncStore.getState().guestMergePrompt;
      useQfSyncStore.setState({
        status: 'retry',
        errorCode: 'guest_merge_failed',
        diagnostics: emptyDiagnostics({errorCode: 'guest_merge_failed'}),
        guestMergePrompt:
          current?.accountId === accountId
            ? {...current, submitting: false}
            : current,
      });
    }
  }

  async stop(): Promise<void> {
    const accountId = activeAccount(this.context);
    this.stopped = true;
    this.epoch += 1;
    this.rerunRequested = false;
    this.cancelRetry();
    await this.options.flushReadingSession(accountId ?? undefined);
    await this.waitForIdle();
  }

  async waitForIdle(): Promise<void> {
    for (;;) {
      const tasks = [
        ...(this.currentRun ? [this.currentRun] : []),
        ...this.maintenanceTasks,
      ];
      if (tasks.length === 0) return;
      await Promise.allSettled(tasks);
    }
  }

  private async runCycle(accountId: string, epoch: number): Promise<void> {
    const startedAt = this.now();
    this.setForCurrent(epoch, accountId, {
      status: 'syncing',
      retryAt: null,
      errorCode: null,
    });
    try {
      const session = await this.options.getSession();
      if (!session || session.profile.accountId !== accountId) {
        await this.handleRevokedSession(epoch, accountId, startedAt, 401);
        return;
      }

      const input = {accountId, sessionToken: session.token};
      const pull = await this.options.coordinator.pull(input);
      if (!this.isCurrent(epoch, accountId)) return;
      if (pull.status === 'deferred') {
        this.handleDeferred(
          epoch,
          accountId,
          pull.reason,
          pull.retryAfterMs,
          startedAt,
        );
        return;
      }

      this.clearActiveViews();
      useQfSyncStore.getState().refreshData();

      const offer = await this.options.guestImportService.getOffer(accountId);
      if (!this.isCurrent(epoch, accountId)) return;
      if (offer) {
        const currentPrompt = useQfSyncStore.getState().guestMergePrompt;
        if (
          currentPrompt?.accountId !== accountId ||
          !currentPrompt.submitting
        ) {
          useQfSyncStore.setState({
            guestMergePrompt: {
              accountId,
              ...offer,
              submitting: false,
            },
          });
        }
      }

      const push = await this.options.coordinator.push(input);
      if (!this.isCurrent(epoch, accountId)) return;
      if (push.status === 'deferred') {
        this.handleDeferred(
          epoch,
          accountId,
          push.reason,
          push.retryAfterMs,
          startedAt,
        );
        return;
      }

      const persisted = await this.options.database.getSyncStatus(accountId);
      if (!this.isCurrent(epoch, accountId)) return;
      const pushedCount = push.status === 'synced' ? push.pushed : 0;
      const ambiguousCount = push.status === 'recovered' ? push.ambiguous : 0;
      const hasConflict = ambiguousCount > 0 || persisted.conflictCount > 0;
      this.setForCurrent(epoch, accountId, {
        status: hasConflict ? 'conflict' : 'idle',
        lastSuccessAt: persisted.lastSuccessfulSyncAt ?? this.now(),
        retryAt: null,
        errorCode: hasConflict ? 'conflict' : null,
        diagnostics: emptyDiagnostics({
          pendingCount: persisted.pendingCount,
          pushedCount,
          ambiguousCount,
          conflictCount: persisted.conflictCount,
          durationMs: Math.max(0, this.now() - startedAt),
          httpClass: '2xx',
          errorCode: hasConflict ? 'conflict' : null,
        }),
      });
      if (push.status === 'synced' && push.pushed >= 100) {
        this.scheduleRetry(epoch, accountId, 0);
      }
    } catch (error) {
      if (!this.isCurrent(epoch, accountId)) return;
      if (
        error instanceof BayaanSyncApiError &&
        error.code === 'session_revoked'
      ) {
        await this.handleRevokedSession(
          epoch,
          accountId,
          startedAt,
          error.status,
        );
        return;
      }
      const errorCode =
        error instanceof BayaanSyncApiError ? error.code : 'sync_failed';
      const httpClass =
        error instanceof BayaanSyncApiError
          ? httpClassForStatus(error.status)
          : 'none';
      this.setForCurrent(epoch, accountId, {
        status: 'retry',
        retryAt: this.now() + DEFAULT_RETRY_MS,
        errorCode,
        diagnostics: emptyDiagnostics({
          durationMs: Math.max(0, this.now() - startedAt),
          httpClass,
          errorCode,
        }),
      });
      this.scheduleRetry(epoch, accountId, DEFAULT_RETRY_MS);
    }
  }

  private handleDeferred(
    epoch: number,
    accountId: string,
    reason: string,
    retryAfterMs: number,
    startedAt: number,
  ): void {
    const status = deferredStatus(reason);
    this.setForCurrent(epoch, accountId, {
      status,
      retryAt: this.now() + retryAfterMs,
      errorCode: reason,
      diagnostics: emptyDiagnostics({
        durationMs: Math.max(0, this.now() - startedAt),
        httpClass: reason === 'conflict' ? '4xx' : 'none',
        errorCode: reason,
      }),
    });
    this.scheduleRetry(epoch, accountId, retryAfterMs);
  }

  private async handleRevokedSession(
    epoch: number,
    accountId: string,
    startedAt: number,
    status: number,
  ): Promise<void> {
    try {
      await this.options.onSessionRevoked();
    } catch {
      // Local lifecycle state still expires even if secure cleanup must retry.
    }
    this.setForCurrent(epoch, accountId, {
      status: 'auth_expired',
      retryAt: null,
      errorCode: 'session_revoked',
      diagnostics: emptyDiagnostics({
        durationMs: Math.max(0, this.now() - startedAt),
        httpClass: httpClassForStatus(status),
        errorCode: 'session_revoked',
      }),
    });
  }

  private scheduleRetry(
    epoch: number,
    accountId: string,
    retryAfterMs: number,
  ): void {
    this.cancelRetry();
    const timer = this.setTimer?.(() => {
      if (!this.isCurrent(epoch, accountId)) return;
      this.retryTimer = null;
      this.requestSync();
    }, retryAfterMs);
    this.retryTimer = timer ?? null;
    const unref = (timer as unknown as {unref?: () => void} | undefined)?.unref;
    unref?.call(timer);
  }

  private cancelRetry(): void {
    if (this.retryTimer && this.clearTimer) {
      this.clearTimer(this.retryTimer);
    }
    this.retryTimer = null;
  }

  private canRun(): boolean {
    const accountId = activeAccount(this.context);
    return Boolean(
      !this.stopped &&
        this.options.enabled &&
        accountId &&
        this.context?.online &&
        this.context.appActive,
    );
  }

  private isCurrent(epoch: number, accountId: string): boolean {
    return (
      !this.stopped &&
      this.epoch === epoch &&
      activeAccount(this.context) === accountId
    );
  }

  private setForCurrent(
    epoch: number,
    accountId: string,
    state: Parameters<typeof useQfSyncStore.setState>[0],
  ): void {
    if (this.isCurrent(epoch, accountId)) {
      useQfSyncStore.setState(state);
    }
  }

  private setAvailabilityStatus(status: QfSyncStatus): void {
    useQfSyncStore.setState({status, retryAt: null, errorCode: null});
  }

  private trackMaintenance(task: Promise<void>): void {
    const tracked = task
      .catch(() => undefined)
      .finally(() => {
        this.maintenanceTasks.delete(tracked);
      });
    this.maintenanceTasks.add(tracked);
  }

  private async hydratePersistedStatus(
    accountId: string,
    epoch: number,
  ): Promise<void> {
    try {
      const persisted = await this.options.database.getSyncStatus(accountId);
      if (!this.isCurrent(epoch, accountId)) return;
      useQfSyncStore.setState(state => ({
        lastSuccessAt: persisted.lastSuccessfulSyncAt,
        diagnostics: {
          ...state.diagnostics,
          pendingCount: persisted.pendingCount,
          conflictCount: persisted.conflictCount,
        },
      }));
    } catch {
      // The next lifecycle run retries storage access without exposing details.
    }
  }
}

const transport = new BayaanSyncApiClient({apiUrl: bayaanAuthConfig.apiUrl});
const coordinator = new QfSyncCoordinator({
  transport,
  store: new SqliteQfSyncPullStore(verseAnnotationDatabase),
  pushStore: qfSyncDatabaseService,
});

export const qfSyncLifecycle = new QfSyncLifecycle({
  enabled: bayaanAuthConfig.qfSyncEnabled,
  coordinator,
  guestImportService: qfGuestImportService,
  database: qfSyncDatabaseService,
  getSession: getBayaanSession,
  onSessionRevoked: async () => {
    try {
      await clearBayaanSession();
    } finally {
      useBayaanAuthStore.getState().setSignedOut();
    }
  },
  flushReadingSession: accountId => qfReadingSessionService.flush(accountId),
});
