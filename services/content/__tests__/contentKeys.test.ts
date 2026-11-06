import {idFromKey, keyFor, kindForKey} from '../contentKeys';

describe('content keys', () => {
  it('reads the kind from the key prefix', () => {
    expect(kindForKey('qf:tafsirs:169')).toBe('tafsir');
    expect(kindForKey('qf:translations:20')).toBe('translation');
    expect(kindForKey('qf:recitations:7')).toBeNull();
  });

  it('maps keys to bare QF ids and back', () => {
    expect(idFromKey('qf:tafsirs:169')).toBe('169');
    expect(idFromKey('qf:translations:20')).toBe('20');
    expect(keyFor('translation', '20')).toBe('qf:translations:20');
    expect(keyFor('tafsir', '169')).toBe('qf:tafsirs:169');
  });
});
