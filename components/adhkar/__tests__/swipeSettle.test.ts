// @ai-generated
import {
  createSwipeSettle,
  SWIPE_SETTLE_FALLBACK_MS,
  type SwipeSettle,
} from '../swipeSettle';

const PAGE = 390;

describe('createSwipeSettle', () => {
  let settled: jest.Mock;
  let swipe: SwipeSettle;

  beforeEach(() => {
    jest.useFakeTimers();
    settled = jest.fn();
    swipe = createSwipeSettle(settled);
  });
  afterEach(() => {
    swipe.dispose();
    jest.useRealTimers();
  });

  it('is not swiping until the user drags', () => {
    expect(swipe.isSwiping()).toBe(false);
  });

  it('settles when the snap after the drag comes to rest', () => {
    swipe.onScrollBeginDrag();
    expect(swipe.isSwiping()).toBe(true);
    // Lifted 60 % of the way to the next page.
    swipe.onScrollEndDrag(PAGE * 0.6, PAGE);
    expect(swipe.isSwiping()).toBe(true);
    expect(settled).not.toHaveBeenCalled();
    swipe.onMomentumScrollEnd();
    expect(swipe.isSwiping()).toBe(false);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('does not settle while the finger is down, however long', () => {
    swipe.onScrollBeginDrag();
    jest.advanceTimersByTime(SWIPE_SETTLE_FALLBACK_MS * 10);
    expect(swipe.isSwiping()).toBe(true);
    expect(settled).not.toHaveBeenCalled();
  });

  it('settles at once when the finger lifts exactly on a page', () => {
    // iOS sends no momentum event when nothing is left to animate.
    swipe.onScrollBeginDrag();
    swipe.onScrollEndDrag(PAGE * 2, PAGE);
    expect(settled).toHaveBeenCalledTimes(1);
    expect(swipe.isSwiping()).toBe(false);
    // A momentum end that does follow (Android) is not a second swipe.
    swipe.onMomentumScrollEnd();
    jest.advanceTimersByTime(SWIPE_SETTLE_FALLBACK_MS);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('counts a sub-point rounding of the offset as on the page', () => {
    swipe.onScrollBeginDrag();
    swipe.onScrollEndDrag(PAGE * 3 - 0.4, PAGE);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('treats page edges the same from either end (RTL offsets)', () => {
    // 5 pages: the same resting page is offset 1 * PAGE from one side and
    // 3 * PAGE from the other.
    swipe.onScrollBeginDrag();
    swipe.onScrollEndDrag(PAGE * 3, PAGE);
    expect(settled).toHaveBeenCalledTimes(1);
    swipe.onScrollBeginDrag();
    swipe.onScrollEndDrag(PAGE * 2.5, PAGE);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('ignores scroll ends that no drag by the user started', () => {
    // A Play All auto-scroll coming to rest.
    swipe.onMomentumScrollEnd();
    expect(settled).not.toHaveBeenCalled();
  });

  it('ignores the scroll end of a snap that a new drag cut short', () => {
    swipe.onScrollBeginDrag();
    swipe.onScrollEndDrag(PAGE * 0.6, PAGE);
    // The user grabs the page again before it has snapped (Android sends
    // the momentum end of the cancelled snap after the new drag began).
    swipe.onScrollBeginDrag();
    swipe.onMomentumScrollEnd();
    expect(settled).not.toHaveBeenCalled();
    expect(swipe.isSwiping()).toBe(true);
    swipe.onScrollEndDrag(PAGE * 1.7, PAGE);
    swipe.onMomentumScrollEnd();
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('settles by itself when no scroll end arrives after the finger lifts', () => {
    swipe.onScrollBeginDrag();
    swipe.onScrollEndDrag(PAGE * 0.6, PAGE);
    jest.advanceTimersByTime(SWIPE_SETTLE_FALLBACK_MS - 1);
    expect(settled).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(settled).toHaveBeenCalledTimes(1);
    expect(swipe.isSwiping()).toBe(false);
    // A late scroll end is not a second swipe.
    swipe.onMomentumScrollEnd();
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('does not fall back while a new drag is in flight', () => {
    swipe.onScrollBeginDrag();
    swipe.onScrollEndDrag(PAGE * 0.6, PAGE);
    swipe.onScrollBeginDrag();
    jest.advanceTimersByTime(SWIPE_SETTLE_FALLBACK_MS * 2);
    expect(settled).not.toHaveBeenCalled();
  });

  it('waits for the snap when the page width is not known', () => {
    swipe.onScrollBeginDrag();
    swipe.onScrollEndDrag(0, null);
    expect(settled).not.toHaveBeenCalled();
    swipe.onMomentumScrollEnd();
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('drops a pending fallback when disposed', () => {
    swipe.onScrollBeginDrag();
    swipe.onScrollEndDrag(PAGE * 0.6, PAGE);
    swipe.dispose();
    jest.advanceTimersByTime(SWIPE_SETTLE_FALLBACK_MS * 2);
    expect(settled).not.toHaveBeenCalled();
  });
});
