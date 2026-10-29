import {
  ORIGIN_TTL_MS,
  claimFocusReturn,
  noteLongPressOrigin,
  restoreFocusTo,
  setScreenFocusRestore,
  takeFocusClaim,
  takeLongPressOrigin,
  type FocusRef,
} from './focusReturn';

const view = () => ({requestTVFocus: jest.fn()});

beforeEach(() => {
  jest.useFakeTimers();
  takeLongPressOrigin();
  takeFocusClaim();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('long-press origin', () => {
  it('is taken once', () => {
    const ref: FocusRef = {current: view()};
    noteLongPressOrigin(ref);
    expect(takeLongPressOrigin()).toBe(ref);
    expect(takeLongPressOrigin()).toBeNull();
  });

  it('is ignored when stale', () => {
    noteLongPressOrigin({current: view()});
    jest.advanceTimersByTime(ORIGIN_TTL_MS + 1);
    expect(takeLongPressOrigin()).toBeNull();
  });

  it('the newest long-press wins', () => {
    const first: FocusRef = {current: view()};
    const second: FocusRef = {current: view()};
    noteLongPressOrigin(first);
    noteLongPressOrigin(second);
    expect(takeLongPressOrigin()).toBe(second);
  });
});

describe('focus claim', () => {
  it('is taken once per close', () => {
    expect(takeFocusClaim()).toBe(false);
    claimFocusReturn();
    expect(takeFocusClaim()).toBe(true);
    expect(takeFocusClaim()).toBe(false);
  });
});

describe('restoreFocusTo', () => {
  it('focuses the opener on the next frame', () => {
    const opener = view();
    const restore = jest.fn();
    const unregister = setScreenFocusRestore(restore);
    restoreFocusTo({current: opener});
    expect(opener.requestTVFocus).not.toHaveBeenCalled();
    jest.advanceTimersByTime(16);
    expect(opener.requestTVFocus).toHaveBeenCalledTimes(1);
    expect(restore).not.toHaveBeenCalled();
    unregister();
  });

  it("falls back to the screen's own focus when the opener left the screen", () => {
    const restore = jest.fn();
    const unregister = setScreenFocusRestore(restore);
    const detached: {current: ReturnType<typeof view> | null} = {
      current: view(),
    };
    restoreFocusTo(detached);
    detached.current = null; // the tile unmounted before the frame
    jest.advanceTimersByTime(16);
    expect(restore).toHaveBeenCalledTimes(1);
    unregister();
  });

  it("falls back to the screen's own focus without an opener", () => {
    const restore = jest.fn();
    const unregister = setScreenFocusRestore(restore);
    restoreFocusTo(null);
    jest.advanceTimersByTime(16);
    expect(restore).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('a stale unregister leaves the newer screen registered', () => {
    const older = jest.fn();
    const newer = jest.fn();
    const unregisterOlder = setScreenFocusRestore(older);
    const unregisterNewer = setScreenFocusRestore(newer);
    unregisterOlder();
    restoreFocusTo(null);
    jest.advanceTimersByTime(16);
    expect(newer).toHaveBeenCalledTimes(1);
    expect(older).not.toHaveBeenCalled();
    unregisterNewer();
  });
});
