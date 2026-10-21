import {showsSurahName, surahNameSize, surahGlyphBox} from './surahArtwork';

describe('showsSurahName', () => {
  it('names tiles but not thumbnails', () => {
    expect(showsSurahName(252, true)).toBe(true);
    expect(showsSurahName(150, true)).toBe(true);
    expect(showsSurahName(88, true)).toBe(false);
  });

  it('never repeats the name where the glyph already is the name', () => {
    expect(showsSurahName(252, false)).toBe(false);
  });
});

describe('surahNameSize', () => {
  it('follows the glyph, within bounds', () => {
    expect(surahNameSize(64)).toBe(26);
    expect(surahNameSize(84)).toBe(34);
    expect(surahNameSize(150)).toBe(40);
    expect(surahNameSize(22)).toBe(18);
  });
});

describe('surahGlyphBox', () => {
  it('keeps the requested size when the ink fits', () => {
    const box = surahGlyphBox(11, 64, 212);
    expect(box.fontSize).toBe(64);
  });

  it('shrinks a long name so its ink fits the width', () => {
    // Al-Ikhlas is about 2.3 em of ink: at 84 px it would be ~194 px wide.
    const box = surahGlyphBox(112, 84, 160);
    expect(box.width).toBeCloseTo(160, 5);
    expect(box.fontSize).toBeLessThan(84);
  });

  it('starts the text left of the box by the glyph’s blank margin', () => {
    const box = surahGlyphBox(1, 100);
    expect(box.textLeft).toBeLessThan(-20);
    expect(box.textWidth).toBeGreaterThan(box.width - box.textLeft);
  });

  it('every surah gets a box', () => {
    for (let n = 1; n <= 114; n++) {
      const box = surahGlyphBox(n, 64, 200);
      expect(box.width).toBeLessThanOrEqual(200 + 1e-9);
      expect(box.height).toBeGreaterThan(0);
    }
  });
});
