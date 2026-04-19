import {readJSON, writeJSON, remove, storage} from './storage';

describe('storage', () => {
  beforeEach(() => storage.clearAll());

  it('reads null when key absent', () => {
    expect(readJSON('missing')).toBeNull();
  });

  it('round-trips JSON', () => {
    writeJSON('k', {a: 1, b: 'two'});
    expect(readJSON<{a: number; b: string}>('k')).toEqual({a: 1, b: 'two'});
  });

  it('returns null on corrupt JSON', () => {
    storage.set('bad', 'not json');
    expect(readJSON('bad')).toBeNull();
  });

  it('remove deletes the key', () => {
    writeJSON('k', 1);
    remove('k');
    expect(readJSON('k')).toBeNull();
  });
});
