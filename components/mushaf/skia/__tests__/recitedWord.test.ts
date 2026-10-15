import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';
import {dkWordPosition} from '../recitedWord';

function words(verseKey: string, texts: string[]): DKWordInfo[] {
  return texts.map((text, i) => ({
    text,
    verseKey,
    wordPositionInVerse: i + 1,
  }));
}

describe('dkWordPosition', () => {
  const fatiha1 = words('1:1', [
    'بِسْمِ',
    'ٱللَّهِ',
    'ٱلرَّحْمَٰنِ',
    'ٱلرَّحِيمِ',
    '۝١',
  ]);

  it('maps word for word when the counts agree, skipping the ayah marker', () => {
    expect(dkWordPosition(fatiha1, 0, 4)).toBe(1);
    expect(dkWordPosition(fatiha1, 3, 4)).toBe(4);
  });

  it('never lands on the ayah marker', () => {
    expect(dkWordPosition(fatiha1, 9, 4)).toBe(4);
  });

  it('falls back to the proportional word when the counts differ (37:130)', () => {
    const ayah = words('37:130', [
      'سَلَٰمٌ',
      'عَلَىٰٓ',
      'إِلْ‌يَاسِينَ',
      '۝١٣٠',
    ]);
    expect(dkWordPosition(ayah, 0, 4)).toBe(1);
    expect(dkWordPosition(ayah, 2, 4)).toBe(2);
    expect(dkWordPosition(ayah, 3, 4)).toBe(3);
  });

  it('returns null without words', () => {
    expect(dkWordPosition([], 0, 4)).toBeNull();
  });
});
