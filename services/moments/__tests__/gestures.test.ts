// @ai-start
import {
  cardGestureHitSlop,
  classifySwipe,
  DOUBLE_TAP_MAX_DELAY_MS,
  HEADER_CLEARANCE,
  HOLD_MIN_DURATION_MS,
  isHoldZone,
  SWIPE_ACTIVE_OFFSET_X,
  SWIPE_DISTANCE,
  SWIPE_FAIL_OFFSET_Y,
  SWIPE_FLICK_DISTANCE,
  SWIPE_FLICK_VELOCITY,
  SWIPE_FOLLOW_MAX,
  swipeFollowOffset,
  TAP_MAX_DISTANCE,
  thirdAt,
} from '../gestures';

describe('thirdAt', () => {
  const width = 390;

  it('splits the card into left, middle and right thirds', () => {
    expect(thirdAt(0, width)).toBe('left');
    expect(thirdAt(129, width)).toBe('left');
    expect(thirdAt(195, width)).toBe('middle');
    expect(thirdAt(130, width)).toBe('middle');
    expect(thirdAt(260, width)).toBe('middle');
    expect(thirdAt(261, width)).toBe('right');
    expect(thirdAt(width, width)).toBe('right');
  });

  it('only the outer thirds hold for 2x', () => {
    expect(isHoldZone(20, width)).toBe(true);
    expect(isHoldZone(370, width)).toBe(true);
    expect(isHoldZone(195, width)).toBe(false);
  });
});

describe('classifySwipe', () => {
  it('opens the profile on a long leftward drag', () => {
    expect(
      classifySwipe({
        translationX: -SWIPE_DISTANCE,
        translationY: 0,
        velocityX: 0,
      }),
    ).toBe('profile');
    expect(
      classifySwipe({translationX: -120, translationY: 30, velocityX: -100}),
    ).toBe('profile');
  });

  it('opens the profile on a short, fast flick', () => {
    expect(
      classifySwipe({
        translationX: -SWIPE_FLICK_DISTANCE - 5,
        translationY: 4,
        velocityX: -SWIPE_FLICK_VELOCITY - 1,
      }),
    ).toBe('profile');
  });

  it('ignores a short, slow drag', () => {
    expect(
      classifySwipe({translationX: -40, translationY: 0, velocityX: -100}),
    ).toBe('none');
  });

  it('ignores a flick that is too short, even when fast', () => {
    expect(
      classifySwipe({translationX: -20, translationY: 0, velocityX: -2000}),
    ).toBe('none');
  });

  it('ignores rightward drags', () => {
    expect(
      classifySwipe({translationX: 120, translationY: 0, velocityX: 1500}),
    ).toBe('none');
    expect(
      classifySwipe({translationX: 0, translationY: 0, velocityX: 0}),
    ).toBe('none');
  });

  it('leaves diagonal and vertical flicks to the list', () => {
    // A vertical flick that drifts left.
    expect(
      classifySwipe({translationX: -80, translationY: -300, velocityX: -900}),
    ).toBe('none');
    // Exactly 2:1 is still too diagonal.
    expect(
      classifySwipe({translationX: -100, translationY: 50, velocityX: -900}),
    ).toBe('none');
    expect(
      classifySwipe({translationX: -100, translationY: 49, velocityX: 0}),
    ).toBe('profile');
  });
});

describe('swipeFollowOffset', () => {
  it('follows a leftward drag a little, up to a cap', () => {
    expect(swipeFollowOffset(-10)).toBeLessThan(0);
    expect(swipeFollowOffset(-10)).toBeGreaterThan(-10);
    expect(swipeFollowOffset(-1000)).toBe(-SWIPE_FOLLOW_MAX);
  });

  it('never moves right', () => {
    expect(swipeFollowOffset(0)).toBe(0);
    expect(swipeFollowOffset(80)).toBe(0);
  });
});

describe('cardGestureHitSlop', () => {
  it('keeps the card gestures out of the header band', () => {
    expect(cardGestureHitSlop(47)).toEqual({top: -(47 + HEADER_CLEARANCE)});
  });
});

describe('tuning', () => {
  it('keeps a single tap responsive', () => {
    expect(DOUBLE_TAP_MAX_DELAY_MS).toBeLessThanOrEqual(300);
  });

  it('starts the hold after the double tap window could start', () => {
    expect(HOLD_MIN_DURATION_MS).toBeGreaterThanOrEqual(250);
  });

  it('fails taps and the swipe before the list scrolls far', () => {
    expect(TAP_MAX_DISTANCE).toBeLessThan(SWIPE_FAIL_OFFSET_Y);
    expect(SWIPE_FAIL_OFFSET_Y).toBeLessThan(Math.abs(SWIPE_ACTIVE_OFFSET_X));
  });
});
// @ai-end
