import states from '../__fixtures__/liveActivity.states.json';
import {
  activityWallEnd,
  activityWallStart,
  isActivityStartResult,
  isNowPlayingActivityState,
  safeActivityRate,
  type NowPlayingActivityState,
} from '../liveActivity';

function fixture(index: number): NowPlayingActivityState {
  const value: unknown = states[index];
  if (!isNowPlayingActivityState(value)) throw new Error('bad fixture');
  return value;
}

describe('isNowPlayingActivityState', () => {
  it('accepts the shared fixtures', () => {
    expect(states.every(isNowPlayingActivityState)).toBe(true);
  });

  it('rejects missing fields, bad ayah and non objects', () => {
    const {rate: _rate, ...noRate} = fixture(0);
    expect(isNowPlayingActivityState(noRate)).toBe(false);
    expect(isNowPlayingActivityState({...fixture(0), ayah: {number: 1}})).toBe(
      false,
    );
    expect(isNowPlayingActivityState({...fixture(0), anchorAt: NaN})).toBe(
      false,
    );
    expect(isNowPlayingActivityState(null)).toBe(false);
    expect(isNowPlayingActivityState([])).toBe(false);
  });
});

describe('wall time', () => {
  it('matches the Swift vectors at 1x', () => {
    expect(activityWallStart(fixture(0))).toBe(1791460679500);
    expect(activityWallEnd(fixture(0))).toBe(1791462479500);
  });

  it('scales by the playback rate', () => {
    expect(activityWallStart(fixture(1))).toBe(1791460200000);
    expect(activityWallEnd(fixture(1))).toBe(1791461400000);
  });

  it('clamps the position and treats a bad rate as 1', () => {
    const past = {...fixture(0), positionSec: 5000, rate: 0};
    expect(activityWallEnd(past)).toBe(past.anchorAt);
    expect(safeActivityRate(-1)).toBe(1);
    expect(safeActivityRate(Number.POSITIVE_INFINITY)).toBe(1);
    expect(safeActivityRate(0.75)).toBe(0.75);
  });
});

describe('isActivityStartResult', () => {
  it('accepts the bridge results only', () => {
    expect(isActivityStartResult('started')).toBe(true);
    expect(isActivityStartResult('deferred')).toBe(true);
    expect(isActivityStartResult('nope')).toBe(false);
    expect(isActivityStartResult(1)).toBe(false);
  });
});
