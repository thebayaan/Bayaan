import {
  completedCount,
  countOne,
  currentCount,
  goTo,
  isCurrentComplete,
  next,
  press,
  prev,
  restart,
  startSession,
  trackEnded,
} from './adhkarSession';

describe('adhkarSession', () => {
  it('starts at the first dhikr with nothing counted', () => {
    const s = startSession('morning-adhkar', [1, 3, 100]);
    expect(s.index).toBe(0);
    expect(s.counts).toEqual([0, 0, 0]);
    expect(s.finished).toBe(false);
  });

  it('treats missing or zero counts as once', () => {
    expect(startSession('x', [0, NaN, 2]).targets).toEqual([1, 1, 2]);
  });

  it('counts up to the target and no further', () => {
    let s = startSession('x', [3]);
    s = countOne(countOne(s));
    expect(currentCount(s)).toBe(2);
    expect(isCurrentComplete(s)).toBe(false);
    s = countOne(countOne(s));
    expect(currentCount(s)).toBe(3);
    expect(isCurrentComplete(s)).toBe(true);
  });

  it('OK counts one and asks to move on when the count is reached', () => {
    let s = startSession('x', [2, 1]);
    let r = press(s);
    expect(r.advance).toBe(false);
    expect(currentCount(r.state)).toBe(1);
    r = press(r.state);
    expect(r.advance).toBe(true);
    s = next(r.state);
    expect(s.index).toBe(1);
    // A dhikr said once moves on with one press.
    expect(press(s).advance).toBe(true);
  });

  it('OK on a complete dhikr moves on without counting past it', () => {
    let s = startSession('x', [1, 1]);
    s = press(s).state;
    const r = press(s);
    expect(r.advance).toBe(true);
    expect(currentCount(r.state)).toBe(1);
  });

  it('finishes after the last dhikr and steps back from the end', () => {
    let s = startSession('x', [1, 1], 1);
    s = next(s);
    expect(s.finished).toBe(true);
    expect(press(s).advance).toBe(false);
    s = prev(s);
    expect(s.finished).toBe(false);
    expect(s.index).toBe(1);
    s = prev(prev(s));
    expect(s.index).toBe(0);
  });

  it('keeps counts while moving around and clears them on restart', () => {
    let s = startSession('x', [3, 3]);
    s = countOne(s);
    s = next(s);
    s = prev(s);
    expect(currentCount(s)).toBe(1);
    s = goTo(s, 99);
    expect(s.index).toBe(1);
    s = restart(s);
    expect(s.counts).toEqual([0, 0]);
    expect(s.index).toBe(0);
  });

  it('with auto-advance, a finished recitation counts and repeats until done', () => {
    let s = startSession('x', [2, 1]);
    let r = trackEnded(s, true);
    expect(r.action).toBe('replay');
    r = trackEnded(r.state, true);
    expect(r.action).toBe('advance');
    expect(completedCount(r.state)).toBe(1);
    s = next(r.state);
    expect(trackEnded(s, true).action).toBe('advance');
  });

  it('without auto-advance, a finished recitation just stops', () => {
    const s = startSession('x', [3]);
    const r = trackEnded(s, false);
    expect(r.action).toBe('stop');
    expect(currentCount(r.state)).toBe(0);
  });
});
