import {showsSurahName, surahNameSize} from './surahArtwork';

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
