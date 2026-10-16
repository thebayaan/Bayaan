import {surahArtworkZoom} from './surahArtworkZoom';

describe('surahArtworkZoom', () => {
  it('zooms a 16:10 tile so the middle fills about half its width', () => {
    expect(surahArtworkZoom(1.6)).toBeCloseTo(1.68, 2);
  });
  it('barely zooms a square slot, which already crops the sides', () => {
    expect(surahArtworkZoom(1)).toBeCloseTo(1.05, 2);
  });
  it('never zooms out, and ignores an empty slot', () => {
    expect(surahArtworkZoom(0.5)).toBe(1);
    expect(surahArtworkZoom(0)).toBe(1);
  });
  it('keeps enough height on wide slots that the name stays in view', () => {
    expect(surahArtworkZoom(3)).toBeCloseTo(1.41, 2);
  });
});
