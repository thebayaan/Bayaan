import type {RankedResult} from '../types';

describe('search types', () => {
  it('compiles a minimal RankedResult', () => {
    const r: RankedResult = {
      id: 'reciter:1',
      type: 'reciter',
      title: 'Test',
      subtitle: 'sub',
      features: {
        textualScore: 0.5,
        personalBoost: 0,
        contextualBoost: 0,
        finalScore: 0.5,
        tier: 'whole_word',
        matchedField: 'name',
        matchedRange: null,
        signal: null,
      },
      payload: {kind: 'reciter', reciter: {id: 1, name: 'Test'} as never},
    };
    expect(r.id).toBe('reciter:1');
  });
});
