import {Alert} from 'react-native';
import {bayaanAuthConfig} from '@/config/bayaanAuth';
import {
  clearBayaanSession,
  getBayaanSession,
} from '@/services/auth/bayaanSessionStorage';
import type {BayaanAuthStatus} from '@/store/bayaanAuthStore';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';
import {
  BayaanSettingsApiClient,
  BayaanSettingsApiError,
} from './bayaanSettingsApiClient';
import {QfSettingsSyncCoordinator} from './qfSettingsSyncCoordinator';

export interface QfSettingsLifecycleContext {
  authStatus: BayaanAuthStatus;
  accountId: string | null;
  online: boolean;
  appActive: boolean;
}

interface SettingsCoordinator {
  setRemoteAvailable(available: boolean): void;
  activateLocal(accountId: string): Promise<void>;
  deactivate(clearAccount?: boolean): Promise<void>;
  syncRemote(accountId: string, sessionToken: string): Promise<void>;
  waitForIdle(): Promise<unknown>;
}

interface LifecycleOptions {
  enabled: boolean;
  coordinator: SettingsCoordinator;
  getSession: typeof getBayaanSession;
  onSessionRevoked: () => Promise<void>;
}

function sameContext(
  left: QfSettingsLifecycleContext | null,
  right: QfSettingsLifecycleContext,
): boolean {
  return (
    left?.authStatus === right.authStatus &&
    left.accountId === right.accountId &&
    left.online === right.online &&
    left.appActive === right.appActive
  );
}

export class QfSettingsSyncLifecycle {
  private context: QfSettingsLifecycleContext | null = null;
  private epoch = 0;
  private currentRun: Promise<void> | null = null;
  private rerunRequested = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempts = 0;

  constructor(private readonly options: LifecycleOptions) {}

  updateContext(context: QfSettingsLifecycleContext): void {
    if (sameContext(this.context, context)) return;
    this.context = context;
    this.cancelRetry();
    this.retryAttempts = 0;
    this.options.coordinator.setRemoteAvailable(
      this.options.enabled &&
        context.authStatus === 'authenticated' &&
        context.online &&
        context.appActive,
    );
    this.epoch += 1;
    const epoch = this.epoch;
    if (
      !this.options.enabled ||
      context.authStatus !== 'authenticated' ||
      !context.accountId
    ) {
      this.options.coordinator.deactivate().catch(() => undefined);
      return;
    }
    this.activate(context, epoch);
  }

  requestSync(): void {
    const context = this.context;
    if (
      !this.options.enabled ||
      !context ||
      context.authStatus !== 'authenticated' ||
      !context.accountId ||
      !context.online ||
      !context.appActive
    )
      return;
    if (this.currentRun) {
      this.rerunRequested = true;
      return;
    }
    const epoch = this.epoch;
    const run = this.run(context.accountId, epoch);
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

  async stop(clearAccount = false): Promise<void> {
    this.epoch += 1;
    this.context = null;
    this.rerunRequested = false;
    this.cancelRetry();
    await this.options.coordinator.deactivate(clearAccount);
    await Promise.allSettled([
      ...(this.currentRun ? [this.currentRun] : []),
      this.options.coordinator.waitForIdle(),
    ]);
  }

  private activate(context: QfSettingsLifecycleContext, epoch: number): void {
    if (!context.accountId) return;
    this.options.coordinator
      .activateLocal(context.accountId)
      .then(() => {
        if (epoch !== this.epoch) return;
        this.retryAttempts = 0;
        if (context.online && context.appActive) this.requestSync();
      })
      .catch(error => {
        if (__DEV__) {
          console.warn('[QfSettingsSync] Local activation deferred:', error);
        }
        if (epoch === this.epoch) this.scheduleRetry(epoch, error, true);
      });
  }

  private async run(accountId: string, epoch: number): Promise<void> {
    try {
      const session = await this.options.getSession();
      if (
        epoch !== this.epoch ||
        !session ||
        session.profile.accountId !== accountId
      )
        return;
      await this.options.coordinator.syncRemote(accountId, session.token);
      this.retryAttempts = 0;
    } catch (error) {
      if (
        epoch === this.epoch &&
        error instanceof BayaanSettingsApiError &&
        error.status === 401
      ) {
        await this.options.onSessionRevoked();
      }
      if (
        __DEV__ &&
        !(error instanceof BayaanSettingsApiError && error.status === 403)
      ) {
        console.warn('[QfSettingsSync] Sync deferred:', error);
      }
      if (
        epoch === this.epoch &&
        (!(error instanceof BayaanSettingsApiError) ||
          error.status === 0 ||
          error.status === 429 ||
          error.status === 412 ||
          error.status >= 500)
      ) {
        this.scheduleRetry(epoch, error);
      }
    }
  }

  private cancelRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private scheduleRetry(
    epoch: number,
    error: unknown,
    retryActivation = false,
  ): void {
    if (this.retryTimer) return;
    const providerDelay =
      error instanceof BayaanSettingsApiError ? (error.retryAfterMs ?? 0) : 0;
    const delay = Math.min(
      Math.max(1_000 * 2 ** this.retryAttempts, providerDelay),
      60_000,
    );
    this.retryAttempts += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (epoch !== this.epoch) return;
      if (retryActivation) {
        const context = this.context;
        if (
          context &&
          context.authStatus === 'authenticated' &&
          context.accountId
        ) {
          this.activate(context, epoch);
        }
        return;
      }
      this.requestSync();
    }, delay);
  }
}

function chooseFirstSyncConflict(): Promise<'local' | 'cloud'> {
  return new Promise(resolve => {
    Alert.alert(
      'Settings found in your account',
      'Use cloud settings, retaining device values where the cloud has none, or keep this device’s settings. Fields this app does not understand stay in the cloud.',
      [
        {
          text: 'Use cloud settings',
          onPress: () => resolve('cloud'),
        },
        {
          text: 'Keep this device',
          onPress: () => resolve('local'),
        },
      ],
      {cancelable: false},
    );
  });
}

const api = new BayaanSettingsApiClient(bayaanAuthConfig.apiUrl);
const coordinator = new QfSettingsSyncCoordinator({
  api,
  chooseFirstSyncConflict,
});

export const qfSettingsSyncLifecycle = new QfSettingsSyncLifecycle({
  enabled: bayaanAuthConfig.qfSyncEnabled,
  coordinator,
  getSession: getBayaanSession,
  onSessionRevoked: async () => {
    await clearBayaanSession();
    useBayaanAuthStore.getState().setSignedOut();
  },
});
