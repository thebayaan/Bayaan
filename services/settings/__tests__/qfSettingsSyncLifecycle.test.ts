jest.mock('../qfSettingsSyncCoordinator', () => ({
  QfSettingsSyncCoordinator: jest.fn().mockImplementation(() => ({
    setRemoteAvailable: jest.fn(),
    activateLocal: jest.fn(async () => undefined),
    deactivate: jest.fn(async () => undefined),
    syncRemote: jest.fn(async () => undefined),
    waitForIdle: jest.fn(async () => undefined),
  })),
}));

import {QfSettingsSyncLifecycle} from '../qfSettingsSyncLifecycle';
import {BayaanSettingsApiError} from '../bayaanSettingsApiClient';

function coordinator() {
  return {
    setRemoteAvailable: jest.fn(),
    activateLocal: jest.fn<Promise<void>, [string]>(),
    deactivate: jest.fn(async () => undefined),
    syncRemote: jest.fn(async () => undefined),
    waitForIdle: jest.fn(async () => undefined),
  };
}

describe('QfSettingsSyncLifecycle', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('backs off repeated lifecycle 412 failures to a bounded delay and cancels on stop', async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const subjectCoordinator = coordinator();
    subjectCoordinator.activateLocal.mockResolvedValue(undefined);
    subjectCoordinator.syncRemote.mockRejectedValue(
      new BayaanSettingsApiError(412, 'QF_SETTINGS_CONFLICT'),
    );
    const lifecycle = new QfSettingsSyncLifecycle({
      enabled: true,
      coordinator: subjectCoordinator,
      getSession: jest.fn(async () => ({
        token: 'opaque-session',
        profile: {accountId: 'account-a'},
      })) as never,
      onSessionRevoked: jest.fn(async () => undefined),
    });
    const settle = async () => {
      for (let i = 0; i < 20; i++) await Promise.resolve();
    };
    try {
      lifecycle.updateContext({
        authStatus: 'authenticated',
        accountId: 'account-a',
        online: true,
        appActive: true,
      });
      await settle();
      expect(subjectCoordinator.syncRemote).toHaveBeenCalledTimes(1);
      const delays = [
        1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000,
      ];
      for (const [index, delay] of delays.entries()) {
        expect(jest.getTimerCount()).toBe(1);
        jest.advanceTimersByTime(delay - 1);
        await settle();
        expect(subjectCoordinator.syncRemote).toHaveBeenCalledTimes(index + 1);
        jest.advanceTimersByTime(1);
        await settle();
        expect(subjectCoordinator.syncRemote).toHaveBeenCalledTimes(index + 2);
      }
      await lifecycle.stop();
      expect(jest.getTimerCount()).toBe(0);
      jest.advanceTimersByTime(120_000);
      await settle();
      expect(subjectCoordinator.syncRemote).toHaveBeenCalledTimes(9);
    } finally {
      await lifecycle.stop();
    }
  });

  test('retries a transient local activation failure without a context change', async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const subjectCoordinator = coordinator();
    subjectCoordinator.activateLocal
      .mockRejectedValueOnce(new Error('storage temporarily unavailable'))
      .mockResolvedValue(undefined);
    const lifecycle = new QfSettingsSyncLifecycle({
      enabled: true,
      coordinator: subjectCoordinator,
      getSession: jest.fn(async () => ({
        token: 'opaque-session',
        profile: {accountId: 'account-a'},
      })) as never,
      onSessionRevoked: jest.fn(async () => undefined),
    });

    lifecycle.updateContext({
      authStatus: 'authenticated',
      accountId: 'account-a',
      online: true,
      appActive: true,
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(subjectCoordinator.activateLocal).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(subjectCoordinator.activateLocal).toHaveBeenCalledTimes(2);
    expect(subjectCoordinator.syncRemote).toHaveBeenCalledWith(
      'account-a',
      'opaque-session',
    );
    await lifecycle.stop();
  });
});
