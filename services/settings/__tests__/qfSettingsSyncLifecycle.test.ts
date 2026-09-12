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
