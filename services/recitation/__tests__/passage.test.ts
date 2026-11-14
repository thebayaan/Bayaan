import {passageOnPage} from '../passage';

const PAGE = ['2:283', '2:284', '2:285', '2:286', '3:1', '3:2'];

describe('passageOnPage', () => {
  it('stops at a surah boundary on the page', () => {
    expect(passageOnPage(PAGE)).toEqual({surah: 2, ayah: 283, ayahEnd: 286});
  });

  it('starts where the reader started', () => {
    expect(passageOnPage(PAGE, {surah: 2, ayah: 285})).toEqual({
      surah: 2,
      ayah: 285,
      ayahEnd: 286,
    });
    expect(passageOnPage(PAGE, {surah: 3, ayah: 1})).toEqual({
      surah: 3,
      ayah: 1,
      ayahEnd: 2,
    });
  });

  it('an ayah not on the page, or an empty page, gives no passage', () => {
    expect(passageOnPage(PAGE, {surah: 4, ayah: 1})).toBeNull();
    expect(passageOnPage([])).toBeNull();
  });
});
