const mockInit = jest.fn();
jest.mock('@/services/content/contentSync', () => ({
  initContentSync: () => mockInit(),
}));

import {startContentSyncAfterInit} from '../startContentSync';

describe('startContentSyncAfterInit', () => {
  beforeEach(() => {
    mockInit.mockReset();
    mockInit.mockResolvedValue(undefined);
  });

  it('calls initContentSync only after initialization resolves', async () => {
    let resolveInit: () => void = () => undefined;
    const initPromise = new Promise<void>(resolve => {
      resolveInit = resolve;
    });
    const started = startContentSyncAfterInit(initPromise);
    await Promise.resolve();
    expect(mockInit).not.toHaveBeenCalled();
    resolveInit();
    await started;
    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  it('logs and swallows content sync failures', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    mockInit.mockRejectedValue(new Error('boom'));
    await expect(
      startContentSyncAfterInit(Promise.resolve()),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      '[ContentSync] init failed',
      expect.any(Error),
    );
    warn.mockRestore();
  });

  it('does not start content sync when initialization rejects', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    await expect(
      startContentSyncAfterInit(Promise.reject(new Error('init'))),
    ).resolves.toBeUndefined();
    expect(mockInit).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[ContentSync] not started: app init failed',
      expect.any(Error),
    );
    warn.mockRestore();
  });
});
