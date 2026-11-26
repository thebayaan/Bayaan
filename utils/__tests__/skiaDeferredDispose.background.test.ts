// Locks the background half of the `disposeAfterPendingDraws` contract.
//
// On Android, Fabric creates no native views while the activity is paused: it
// holds them and creates them in the first frame after the return. A Skia
// `<Canvas>` that mounts in the background therefore has no view yet, and
// React Native Skia keeps its recording until the view registers, then draws
// it. The recording reads each paragraph again when it draws, so a paragraph
// disposed in the background makes that first frame throw "Attempted to
// access a disposed object", and React Native tears down the React instance.
//
// These tests drive AppState, the frames and the UI-queue barrier by hand.

import type {AppStateStatus} from 'react-native';

const mockRunOnUIAsync = jest.fn();

jest.mock('react-native-worklets', () => ({
  runOnUIAsync: (...args: unknown[]) => mockRunOnUIAsync(...args),
}));

type Helper = typeof import('../skiaDeferredDispose');
type ReactNativeModule = typeof import('react-native');

let helper: Helper;
let appState: {currentState: AppStateStatus};
let addEventListener: jest.Mock;

/** Callbacks waiting for the next frame. */
let nextFrame: FrameRequestCallback[] = [];
/** Barriers queued on the UI thread that have not run yet, oldest first. */
let uiQueue: Array<() => void> = [];

/** A fresh copy of the helper (its state included), on `os`. */
function load(os: 'android' | 'ios', initial: AppStateStatus): void {
  const ReactNative = require('react-native') as ReactNativeModule;
  jest.replaceProperty(ReactNative.Platform, 'OS', os);
  appState = ReactNative.AppState as unknown as {currentState: AppStateStatus};
  appState.currentState = initial;
  addEventListener = ReactNative.AppState.addEventListener as jest.Mock;
  helper = require('../skiaDeferredDispose') as Helper;
}

/** What React Native does on a change: the state first, then the listeners. */
function changeAppState(next: AppStateStatus): void {
  appState.currentState = next;
  addEventListener.mock.calls
    .filter(([type]) => type === 'change')
    .forEach(([, listener]) => listener(next));
}

/** One frame: the callbacks requested before it. Ones they request wait. */
function runFrame(): void {
  const due = nextFrame;
  nextFrame = [];
  due.forEach(callback => callback(0));
}

/** The UI thread runs every queued barrier, then the JS side settles. */
async function drainUiQueue(): Promise<void> {
  const due = uiQueue;
  uiQueue = [];
  due.forEach(run => run());
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

/** Back in the foreground: active, two frames, then the UI queue drains. */
async function returnToForeground(): Promise<void> {
  changeAppState('active');
  runFrame();
  runFrame();
  await drainUiQueue();
}

const makeDisposable = () => ({dispose: jest.fn()});

beforeEach(() => {
  jest.resetModules();
  nextFrame = [];
  uiQueue = [];
  mockRunOnUIAsync.mockReset();
  mockRunOnUIAsync.mockImplementation(
    () =>
      new Promise<void>(resolve => {
        uiQueue.push(resolve);
      }),
  );
  jest
    .spyOn(global, 'requestAnimationFrame')
    .mockImplementation(callback => nextFrame.push(callback));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('disposeAfterPendingDraws on Android in the background', () => {
  it('holds a disposal until the app is active, two frames have run and the UI queue has drained', async () => {
    load('android', 'background');
    const paragraph = makeDisposable();

    helper.disposeAfterPendingDraws([paragraph]);
    await drainUiQueue();
    expect(paragraph.dispose).not.toHaveBeenCalled();

    changeAppState('active');
    await drainUiQueue();
    expect(paragraph.dispose).not.toHaveBeenCalled();

    runFrame();
    await drainUiQueue();
    expect(paragraph.dispose).not.toHaveBeenCalled();

    runFrame();
    // Then behind the UI queue, as in the foreground.
    expect(mockRunOnUIAsync).toHaveBeenCalledTimes(1);
    expect(paragraph.dispose).not.toHaveBeenCalled();
    await drainUiQueue();
    expect(paragraph.dispose).toHaveBeenCalledTimes(1);
  });

  it('holds a disposal whose barrier runs after the app went to the background', async () => {
    load('android', 'active');
    const paragraph = makeDisposable();

    helper.disposeAfterPendingDraws([paragraph]);
    changeAppState('background');
    await drainUiQueue();
    expect(paragraph.dispose).not.toHaveBeenCalled();

    await returnToForeground();
    expect(paragraph.dispose).toHaveBeenCalledTimes(1);
  });

  it('holds a disposal requested after the return until the same two frames have run', async () => {
    load('android', 'background');
    const early = makeDisposable();
    const late = makeDisposable();

    helper.disposeAfterPendingDraws([early]);
    changeAppState('active');
    // Active again, but Fabric may not have created the held views yet.
    helper.disposeAfterPendingDraws([late]);
    await drainUiQueue();
    expect(late.dispose).not.toHaveBeenCalled();

    runFrame();
    runFrame();
    await drainUiQueue();
    expect(early.dispose).toHaveBeenCalledTimes(1);
    expect(late.dispose).toHaveBeenCalledTimes(1);
  });

  it('starts the two frames over when the app leaves again before they have run', async () => {
    load('android', 'background');
    const paragraph = makeDisposable();

    helper.disposeAfterPendingDraws([paragraph]);
    changeAppState('active');
    runFrame();
    changeAppState('background');
    // The second frame of the abandoned wait.
    runFrame();
    await drainUiQueue();
    expect(paragraph.dispose).not.toHaveBeenCalled();

    changeAppState('active');
    runFrame();
    await drainUiQueue();
    expect(paragraph.dispose).not.toHaveBeenCalled();

    runFrame();
    await drainUiQueue();
    expect(paragraph.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes every held object exactly once, and holds none of them after', async () => {
    load('android', 'background');
    const objects = Array.from({length: 5}, makeDisposable);
    const [a, b, c, d, e] = objects;

    helper.disposeAfterPendingDraws([a, b]);
    helper.disposeAfterPendingDraws([c]);
    helper.disposeAfterPendingDraws([null, d, undefined, e]);
    await returnToForeground();
    objects.forEach(object => expect(object.dispose).toHaveBeenCalledTimes(1));

    // Nothing stays held: another trip away and back disposes nothing more.
    changeAppState('background');
    await returnToForeground();
    objects.forEach(object => expect(object.dispose).toHaveBeenCalledTimes(1));
  });

  it('holds at most MAX_HELD_DISPOSALS: the oldest past it are dropped, never disposed', async () => {
    load('android', 'background');
    const max = helper.MAX_HELD_DISPOSALS;
    expect(max).toBeGreaterThan(0);
    const objects = Array.from({length: max + 3}, makeDisposable);

    objects.forEach(object => helper.disposeAfterPendingDraws([object]));
    await returnToForeground();

    objects
      .slice(0, 3)
      .forEach(object => expect(object.dispose).not.toHaveBeenCalled());
    objects
      .slice(3)
      .forEach(object => expect(object.dispose).toHaveBeenCalledTimes(1));
  });

  it('holds in the background even when the worklets runtime is unavailable', () => {
    load('android', 'background');
    mockRunOnUIAsync.mockImplementation(() => {
      throw new Error('worklets unavailable');
    });
    const paragraph = makeDisposable();

    helper.disposeAfterPendingDraws([paragraph]);
    expect(paragraph.dispose).not.toHaveBeenCalled();

    changeAppState('active');
    runFrame();
    expect(paragraph.dispose).not.toHaveBeenCalled();
    runFrame();
    expect(paragraph.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('disposeAfterPendingDraws in the foreground, as before', () => {
  it('disposes behind the UI queue on Android, with no frame wait', async () => {
    load('android', 'active');
    const paragraph = makeDisposable();
    const strokeParagraph = makeDisposable();

    helper.disposeAfterPendingDraws([paragraph, strokeParagraph]);
    expect(mockRunOnUIAsync).toHaveBeenCalledTimes(1);
    expect(paragraph.dispose).not.toHaveBeenCalled();

    await drainUiQueue();
    expect(paragraph.dispose).toHaveBeenCalledTimes(1);
    expect(strokeParagraph.dispose).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('never holds on iOS, which creates views in the background', async () => {
    load('ios', 'background');
    const paragraph = makeDisposable();

    helper.disposeAfterPendingDraws([paragraph]);
    await drainUiQueue();
    expect(paragraph.dispose).toHaveBeenCalledTimes(1);
    expect(addEventListener).not.toHaveBeenCalled();
  });
});
