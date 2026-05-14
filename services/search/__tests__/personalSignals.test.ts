import { computePersonalBoost } from '../personalSignals';

describe('computePersonalBoost', () => {
  const empty = {
    lovedReciterIds: new Set<string>(),
    lovedTrackIds: new Set<string>(),
    downloadedTrackIds: new Set<string>(),
    defaultReciterId: null,
    defaultRewayatId: null,
    recentResultIds: new Set<string>(),
  };

  it('returns 0 when no signals match', () => {
    expect(computePersonalBoost('reciter:r1', empty).boost).toBe(0);
  });

  it('applies loved reciter boost of 0.20', () => {
    const ctx = { ...empty, lovedReciterIds: new Set(['r1']) };
    const out = computePersonalBoost('reciter:r1', ctx);
    expect(out.boost).toBeCloseTo(0.2);
    expect(out.signal).toBe('loved');
  });

  it('applies default reciter boost of 0.20', () => {
    const ctx = { ...empty, defaultReciterId: 'r5' };
    const out = computePersonalBoost('reciter:r5', ctx);
    expect(out.boost).toBeCloseTo(0.2);
    expect(out.signal).toBe('default');
  });

  it('applies recent search boost of 0.30', () => {
    const ctx = { ...empty, recentResultIds: new Set(['surah:36']) };
    const out = computePersonalBoost('surah:36', ctx);
    expect(out.boost).toBeCloseTo(0.3);
    expect(out.signal).toBe('recent');
  });

  it('sums multiple signals and caps total at 1.0', () => {
    const ctx = {
      ...empty,
      lovedReciterIds: new Set(['r1']),
      defaultReciterId: 'r1',
      recentResultIds: new Set(['reciter:r1']),
    };
    const out = computePersonalBoost('reciter:r1', ctx);
    expect(out.boost).toBeCloseTo(0.7); // 0.2 loved + 0.2 default + 0.3 recent
    expect(out.signal).toBe('loved'); // priority: loved > recent > default
  });

  it('applies default rewayat boost', () => {
    const ctx = { ...empty, defaultRewayatId: 'hafs-an-assem' };
    const out = computePersonalBoost('rewayat:hafs-an-assem', ctx);
    expect(out.boost).toBeCloseTo(0.2);
    expect(out.signal).toBe('default');
  });
});
