import {retryUntilDone, SYNC_RETRY_MS} from './syncRetry';

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('retryUntilDone', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('tries again on a timer until the lookup succeeds, then stops', async () => {
    const results = [false, false, true];
    const attempt = jest.fn(async () => results.shift() ?? true);
    const stop = retryUntilDone(attempt);
    await flush();
    expect(attempt).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(SYNC_RETRY_MS);
    await flush();
    jest.advanceTimersByTime(SYNC_RETRY_MS);
    await flush();
    expect(attempt).toHaveBeenCalledTimes(3);
    jest.advanceTimersByTime(SYNC_RETRY_MS * 3);
    await flush();
    expect(attempt).toHaveBeenCalledTimes(3);
    stop();
  });

  it('stops trying once cleaned up', async () => {
    const attempt = jest.fn(async () => false);
    const stop = retryUntilDone(attempt);
    await flush();
    stop();
    jest.advanceTimersByTime(SYNC_RETRY_MS * 2);
    await flush();
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('tries again when the app comes back to the front', async () => {
    let foreground: (() => void) | null = null;
    const attempt = jest.fn(async () => false);
    const stop = retryUntilDone(attempt, run => {
      foreground = run;
      return () => {
        foreground = null;
      };
    });
    await flush();
    (foreground as (() => void) | null)?.();
    await flush();
    expect(attempt).toHaveBeenCalledTimes(2);
    stop();
    expect(foreground).toBeNull();
  });

  it('keeps trying after a lookup that throws', async () => {
    const attempt = jest
      .fn<Promise<boolean>, []>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(true);
    const stop = retryUntilDone(attempt);
    await flush();
    jest.advanceTimersByTime(SYNC_RETRY_MS);
    await flush();
    expect(attempt).toHaveBeenCalledTimes(2);
    stop();
  });
});
