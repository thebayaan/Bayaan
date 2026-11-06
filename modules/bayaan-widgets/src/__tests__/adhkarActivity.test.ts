import states from '../__fixtures__/adhkarActivity.states.json';
import {isAdhkarSessionActivityState} from '../adhkarActivity';

describe('isAdhkarSessionActivityState', () => {
  it('accepts the shared fixtures', () => {
    expect(states.every(isAdhkarSessionActivityState)).toBe(true);
  });

  it('rejects missing fields, non-integer positions and non objects', () => {
    const {total: _total, ...noTotal} = states[0];
    expect(isAdhkarSessionActivityState(noTotal)).toBe(false);
    expect(isAdhkarSessionActivityState({...states[0], position: 1.5})).toBe(
      false,
    );
    expect(isAdhkarSessionActivityState({...states[0], isPlaying: 'yes'})).toBe(
      false,
    );
    expect(isAdhkarSessionActivityState(null)).toBe(false);
    expect(isAdhkarSessionActivityState([])).toBe(false);
  });
});
