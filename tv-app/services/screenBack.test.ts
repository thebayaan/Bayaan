import {consumeScreenBack, pushScreenBack} from './screenBack';

describe('screenBack', () => {
  it('asks the newest handler first and stops at the first true', () => {
    const calls: string[] = [];
    const removeA = pushScreenBack(() => {
      calls.push('a');
      return true;
    });
    const removeB = pushScreenBack(() => {
      calls.push('b');
      return false;
    });
    expect(consumeScreenBack()).toBe(true);
    expect(calls).toEqual(['b', 'a']);
    removeA();
    removeB();
    expect(consumeScreenBack()).toBe(false);
  });
});
