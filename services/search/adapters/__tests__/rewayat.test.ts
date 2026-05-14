import {buildRewayatIndex, rewayatToResult} from '../rewayat';
import {REWAYAT_REGISTRY} from '@/data/rewayat';

describe('rewayat adapter', () => {
  const idx = buildRewayatIndex(
    REWAYAT_REGISTRY as import('@/data/rewayat').RewayatEntry[],
  );

  it('matches Hafs', () => {
    const hits = idx.search('hafs');
    expect(hits[0].id).toBe('rewayat:hafs-an-assem');
  });

  it('matches by Arabic alias', () => {
    const hits = idx.search('حفص');
    expect(hits[0].id).toBe('rewayat:hafs-an-assem');
  });

  it('rewayatToResult produces correct shape', () => {
    const hafs = REWAYAT_REGISTRY.find(r => r.id === 'hafs-an-assem')!;
    const r = rewayatToResult(hafs, {
      textualScore: 1,
      personalBoost: 0,
      contextualBoost: 0,
      finalScore: 1,
      tier: 'exact',
      matchedField: 'displayName',
      matchedRange: null,
      signal: null,
    });
    expect(r.type).toBe('rewayat');
    expect(r.title).toBe('Hafs');
  });
});
