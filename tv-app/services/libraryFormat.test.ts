import {progressOf, timeLeftLabel} from './libraryFormat';

describe('timeLeftLabel', () => {
  it('says Started without a length', () => {
    expect(timeLeftLabel({positionSeconds: 30, durationSeconds: 0})).toBe(
      'Started',
    );
  });

  it('counts minutes, then hours', () => {
    expect(timeLeftLabel({positionSeconds: 40, durationSeconds: 60})).toBe(
      'Almost done',
    );
    expect(timeLeftLabel({positionSeconds: 0, durationSeconds: 480})).toBe(
      '8 min left',
    );
    expect(timeLeftLabel({positionSeconds: 0, durationSeconds: 4320})).toBe(
      '1 h 12 min left',
    );
    expect(timeLeftLabel({positionSeconds: 0, durationSeconds: 7200})).toBe(
      '2 h left',
    );
  });
});

describe('progressOf', () => {
  it('clamps to 0..1', () => {
    expect(progressOf({positionSeconds: 30, durationSeconds: 60})).toBe(0.5);
    expect(progressOf({positionSeconds: 90, durationSeconds: 60})).toBe(1);
    expect(progressOf({positionSeconds: 9, durationSeconds: 0})).toBe(0);
  });
});
