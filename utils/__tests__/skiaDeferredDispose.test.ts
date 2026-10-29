// @ai-start
// Locks the ordering contract of `disposeAfterPendingDraws`.
//
// The crash this guards is a cross-thread use-after-free. Jest cannot observe
// a real UI thread, so these tests assert the JS-side contract only: the
// dispose never runs synchronously, and it runs exactly once the worklets
// UI-queue barrier reports that the queue drained past it.

const mockRunOnUIAsync = jest.fn();

jest.mock('react-native-worklets', () => ({
  runOnUIAsync: (...args: unknown[]) => mockRunOnUIAsync(...args),
}));

import {disposeAfterPendingDraws} from '../skiaDeferredDispose';

const makeDisposable = () => ({dispose: jest.fn()});

describe('disposeAfterPendingDraws', () => {
  beforeEach(() => {
    mockRunOnUIAsync.mockReset();
    mockRunOnUIAsync.mockResolvedValue(undefined);
  });

  it('does not dispose synchronously', () => {
    const paragraph = makeDisposable();

    disposeAfterPendingDraws([paragraph]);

    expect(paragraph.dispose).not.toHaveBeenCalled();
    expect(mockRunOnUIAsync).toHaveBeenCalledTimes(1);
  });

  it('disposes every object after the UI-queue barrier resolves', async () => {
    const paragraph = makeDisposable();
    const strokeParagraph = makeDisposable();

    disposeAfterPendingDraws([paragraph, strokeParagraph]);
    await Promise.resolve();
    await Promise.resolve();

    expect(paragraph.dispose).toHaveBeenCalledTimes(1);
    expect(strokeParagraph.dispose).toHaveBeenCalledTimes(1);
  });

  // This test guards the one property whose loss disables the fix in silence.
  // Drop `react-native-reanimated/plugin` from `babel.config.js` and the
  // barrier becomes a plain function. `runOnUIAsync` then throws its `__DEV__`
  // guard, the `catch` restores the pre-fix direct dispose, and nothing logs.
  it('queues one barrier worklet that captures nothing', () => {
    disposeAfterPendingDraws([makeDisposable()]);

    expect(mockRunOnUIAsync).toHaveBeenCalledTimes(1);
    const [worklet, ...rest] = mockRunOnUIAsync.mock.calls[0];
    expect(typeof worklet).toBe('function');
    expect(rest).toHaveLength(0);
    expect(worklet.__workletHash).toBeDefined();
    // Worklets 0.13 omits `__closure` when a worklet captures nothing.
    expect(worklet.__closure).toBeUndefined();
  });

  it('skips null and undefined entries', async () => {
    const paragraph = makeDisposable();

    disposeAfterPendingDraws([null, paragraph, undefined]);
    await Promise.resolve();
    await Promise.resolve();

    expect(paragraph.dispose).toHaveBeenCalledTimes(1);
  });

  it('queues no barrier when every entry is empty', () => {
    disposeAfterPendingDraws([null, undefined]);

    expect(mockRunOnUIAsync).not.toHaveBeenCalled();
  });

  it('disposes immediately when the worklets runtime is unavailable', () => {
    const paragraph = makeDisposable();
    mockRunOnUIAsync.mockImplementation(() => {
      throw new Error('worklets unavailable');
    });

    disposeAfterPendingDraws([paragraph]);

    expect(paragraph.dispose).toHaveBeenCalledTimes(1);
  });

  // `runOnUIAsync` rejects only when the barrier worklet throws on the UI
  // thread (`threads.native.ts`), so the earlier draws have run by then.
  it('disposes when the barrier promise rejects', async () => {
    const paragraph = makeDisposable();
    mockRunOnUIAsync.mockRejectedValue(new Error('barrier threw'));

    disposeAfterPendingDraws([paragraph]);
    await Promise.resolve();
    await Promise.resolve();

    expect(paragraph.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes the remaining objects when one dispose throws', async () => {
    const failing = {
      dispose: jest.fn(() => {
        throw new Error('already disposed');
      }),
    };
    const paragraph = makeDisposable();

    disposeAfterPendingDraws([failing, paragraph]);
    await Promise.resolve();
    await Promise.resolve();

    expect(failing.dispose).toHaveBeenCalledTimes(1);
    expect(paragraph.dispose).toHaveBeenCalledTimes(1);
  });
});
// @ai-end
