// @ai-generated
import {selectedTimerOption} from '../playback';

describe('selectedTimerOption', () => {
  it('marks nothing when the timer is off', () => {
    expect(selectedTimerOption(null, 0)).toBeUndefined();
  });

  it('marks the option the remaining time is within two minutes of', () => {
    expect(selectedTimerOption(14, 0)).toBe(15);
    expect(selectedTimerOption(29.5, 0)).toBe(30);
  });

  it('marks nothing between options', () => {
    expect(selectedTimerOption(22, 0)).toBeUndefined();
  });
});
