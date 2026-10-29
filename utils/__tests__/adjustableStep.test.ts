// @ai-generated
import {adjustableStep} from '../adjustableStep';

describe('adjustableStep', () => {
  it('steps up and down by one inside the range', () => {
    expect(adjustableStep('increment', 5, 1, 10)).toBe(6);
    expect(adjustableStep('decrement', 5, 1, 10)).toBe(4);
  });

  it('does nothing at the bounds', () => {
    expect(adjustableStep('increment', 10, 1, 10)).toBeNull();
    expect(adjustableStep('decrement', 1, 1, 10)).toBeNull();
  });

  it('ignores other accessibility actions', () => {
    expect(adjustableStep('activate', 5, 1, 10)).toBeNull();
  });
});
