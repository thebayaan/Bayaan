// @ai-generated
/**
 * The /mushaf params of a Quran search hit: its verse, an anchor on its
 * first matched slot and the slots to flash, never a page (the reader opens
 * the page of the first matched slot: MushafScreenSavedVerseOpen.test.tsx).
 */
import {
  firstHitSlot,
  parseFlashWords,
  quranHitOpenParams,
} from '../quranHitParams';

describe('firstHitSlot', () => {
  it('is the slot the anchor names, whatever the order (1 with none)', () => {
    expect(firstHitSlot([77, 76, 77])).toBe(76);
    expect(quranHitOpenParams('2:282', [77, 76, 77]).anchor).toBe(
      `2:282:${firstHitSlot([77, 76, 77])}`,
    );
    expect(firstHitSlot([])).toBe(1);
    expect(quranHitOpenParams('1:1', []).anchor).toBe('1:1:1');
  });
});

describe('quranHitOpenParams', () => {
  it('anchors the first matched slot and lists the slots once, in order', () => {
    expect(quranHitOpenParams('2:282', [77, 76, 77])).toEqual({
      surah: '2',
      ayah: '282',
      anchor: '2:282:76',
      words: '76,77',
    });
  });

  it('sends no page', () => {
    expect(quranHitOpenParams('1:1', [3])).not.toHaveProperty('page');
  });
});

describe('parseFlashWords', () => {
  it('reads what quranHitOpenParams writes', () => {
    expect(parseFlashWords(quranHitOpenParams('2:255', [4, 3]).words)).toEqual([
      3, 4,
    ]);
  });

  it('drops what is not a slot', () => {
    expect(parseFlashWords('x,0,3, 4 ,256,2.5')).toEqual([3, 4]);
    expect(parseFlashWords('')).toEqual([]);
    expect(parseFlashWords(undefined)).toEqual([]);
  });
});
