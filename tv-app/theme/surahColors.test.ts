import {
  GLOW_PALETTES,
  surahGlow,
  surahGradient,
  TILE_HUES,
} from './surahColors';

describe('surahGradient', () => {
  it('uses the designed pair for featured surahs', () => {
    expect(surahGradient(18)).toEqual(['#2563EB', '#4F46E5']);
    expect(surahGradient(67)).toEqual(['#312E81', '#2563EB']);
  });

  it('gives every surah two different brand hues', () => {
    for (let n = 1; n <= 114; n++) {
      const [from, to] = surahGradient(n);
      expect(from).not.toBe(to);
      if (n !== 32 && n !== 67) {
        expect(TILE_HUES).toContain(from);
        expect(TILE_HUES).toContain(to);
      }
    }
  });

  it('is stable for the same surah', () => {
    expect(surahGradient(40)).toEqual(surahGradient(40));
  });

  it('clamps out-of-range input instead of throwing', () => {
    expect(surahGradient(0)).toEqual(surahGradient(1));
    expect(surahGradient(500)).toEqual(surahGradient(114));
    expect(surahGradient(Number.NaN)).toEqual(surahGradient(1));
  });
});

describe('surahGlow', () => {
  it('cycles through the mobile glow palettes like paletteForSurah', () => {
    expect(surahGlow(1)).toBe(GLOW_PALETTES[0]);
    expect(surahGlow(7)).toBe(GLOW_PALETTES[0]);
    expect(surahGlow(18)).toBe(GLOW_PALETTES[5]);
  });
});
