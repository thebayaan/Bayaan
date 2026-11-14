import {
  advanceRevealed,
  isRevealed,
  peekAyah,
  peekWord,
  WHOLE_AYAH,
  type RevealSource,
} from '../reveal';

// Al-Ikhlas: 4 ayat of 4, 2, 3, 5 words; Al-Falaq follows.
const WORDS: Record<string, number> = {
  '112:1': 4,
  '112:2': 2,
  '112:3': 3,
  '112:4': 5,
};
const source: RevealSource = {
  ayahCount: surah => (surah === 112 ? 4 : 5),
  lastPosition: (surah, ayah) => WORDS[`${surah}:${ayah}`] ?? 6,
};

describe('reveal', () => {
  it('shows everything before the point and nothing after', () => {
    const through = {surah: 112, ayah: 3, position: 2};
    expect(isRevealed(through, 112, 1, 4)).toBe(true);
    expect(isRevealed(through, 112, 3, 2)).toBe(true);
    expect(isRevealed(through, 112, 3, 3)).toBe(false);
    expect(isRevealed(through, 112, 4, 1)).toBe(false);
    expect(isRevealed(through, 111, 5, 9)).toBe(true);
    expect(isRevealed(null, 1, 1, 1)).toBe(false);
  });

  it('only moves forward', () => {
    const at = {surah: 112, ayah: 3, position: 2};
    expect(advanceRevealed(at, {surah: 112, ayah: 2, position: 1})).toBe(at);
    expect(advanceRevealed(at, {surah: 112, ayah: 4, position: 1})).toEqual({
      surah: 112,
      ayah: 4,
      position: 1,
    });
  });

  it('peeks the next word, crossing into the next ayah and surah', () => {
    const start = {surah: 112, ayah: 1};
    expect(peekWord(null, start, source)).toEqual({...start, position: 1});
    expect(peekWord({surah: 112, ayah: 2, position: 1}, start, source)).toEqual(
      {surah: 112, ayah: 2, position: 2},
    );
    expect(peekWord({surah: 112, ayah: 2, position: 2}, start, source)).toEqual(
      {surah: 112, ayah: 3, position: 1},
    );
    expect(
      peekWord({surah: 112, ayah: 4, position: WHOLE_AYAH}, start, source),
    ).toEqual({surah: 113, ayah: 1, position: 1});
  });

  it('peeks the rest of the ayah, then the next ayah', () => {
    const start = {surah: 112, ayah: 1};
    expect(peekAyah({surah: 112, ayah: 3, position: 1}, start, source)).toEqual(
      {surah: 112, ayah: 3, position: WHOLE_AYAH},
    );
    expect(
      peekAyah({surah: 112, ayah: 3, position: WHOLE_AYAH}, start, source),
    ).toEqual({surah: 112, ayah: 4, position: WHOLE_AYAH});
    expect(peekAyah(null, start, source)).toEqual({
      ...start,
      position: WHOLE_AYAH,
    });
  });
});
