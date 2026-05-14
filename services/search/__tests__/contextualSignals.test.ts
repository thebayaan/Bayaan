import {computeContextualBoost} from '../contextualSignals';

const MONDAY_9AM = new Date(2026, 4, 11, 9, 0).getTime(); // Mon May 11 2026 09:00
const FRIDAY_2PM = new Date(2026, 4, 15, 14, 0).getTime(); // Fri May 15 2026 14:00
const MONDAY_7PM = new Date(2026, 4, 11, 19, 0).getTime(); // Mon May 11 2026 19:00

describe('computeContextualBoost', () => {
  it('boosts morning adhkar at 9am', () => {
    const out = computeContextualBoost('adhkar:27', {now: MONDAY_9AM});
    expect(out.boost).toBeCloseTo(0.1);
    expect(out.signal).toBe('morning');
  });

  it('boosts evening adhkar at 7pm', () => {
    const out = computeContextualBoost('adhkar:27', {now: MONDAY_7PM});
    expect(out.boost).toBeCloseTo(0.1);
    expect(out.signal).toBe('evening');
  });

  it('boosts Al-Kahf on Friday', () => {
    const out = computeContextualBoost('surah:18', {now: FRIDAY_2PM});
    expect(out.boost).toBeCloseTo(0.12);
    expect(out.signal).toBe('friday');
  });

  it('caps cumulative boost at 0.15', () => {
    const fridayMorn = new Date(2026, 4, 15, 9, 0).getTime();
    const out = computeContextualBoost('adhkar:27', {now: fridayMorn});
    expect(out.boost).toBeLessThanOrEqual(0.15);
  });

  it('returns 0 when no contextual rule matches', () => {
    const out = computeContextualBoost('reciter:r1', {now: MONDAY_9AM});
    expect(out.boost).toBe(0);
    expect(out.signal).toBeNull();
  });
});
