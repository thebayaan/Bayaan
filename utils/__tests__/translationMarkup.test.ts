// @ai-generated
// Copy and Share-as-text pasted `<sup foot_note="…">1</sup>` in the middle of
// the verse, and the Translation sheet and Clear Quran rows showed the
// footnote number stuck to the word before it ("Allāh,1 the Entirely
// Merciful"). The strings below are the bundled translations' own.

import {stripTranslationMarkup} from '../translationMarkup';
import {
  getBundledTranslation,
  getBundledTranslationRaw,
} from '../translationLookup';

const saheeh =
  require('@/data/SaheehInternational.translation-with-footnote-tags.json') as Record<
    string,
    {t: string}
  >;
const clearQuran = require('@/data/clear-quran-translation.json') as {
  translations: {text: string}[];
};

describe('stripTranslationMarkup', () => {
  it('removes Saheeh footnote markers together with their numbers (1:1)', () => {
    const raw = getBundledTranslationRaw('1:1', 'saheeh');
    expect(raw).toBe(
      'In the name of Allāh,<sup foot_note="226402">1</sup> the Entirely Merciful, the Especially Merciful.<sup foot_note="226403">2</sup>',
    );
    expect(stripTranslationMarkup(raw)).toBe(
      'In the name of Allāh, the Entirely Merciful, the Especially Merciful.',
    );
  });

  it('removes every marker of a verse with several footnotes (2:255)', () => {
    const raw = getBundledTranslationRaw('2:255', 'saheeh');
    expect(raw).toContain(
      'the Ever-Living,<sup foot_note="226497">1</sup> the Self-Sustaining.<sup foot_note="226498">2</sup> Neither',
    );
    expect(stripTranslationMarkup(raw)).toBe(
      'Allāh - there is no deity except Him, the Ever-Living, the Self-Sustaining. Neither drowsiness overtakes Him nor sleep. To Him belongs whatever is in the heavens and whatever is on the earth. Who is it that can intercede with Him except by His permission? He knows what is [presently] before them and what will be after them, and they encompass not a thing of His knowledge except for what He wills. His Kursī extends over the heavens and the earth, and their preservation tires Him not. And He is the Most High, the Most Great.',
    );
  });

  it('removes Clear Quran markers, whose attribute is not quoted', () => {
    const raw = getBundledTranslationRaw('2:1', 'clear-quran');
    expect(raw).toBe('Alif-Lãm-Mĩm.<sup foot_note=76375>1</sup>');
    expect(stripTranslationMarkup(raw)).toBe('Alif-Lãm-Mĩm.');
    expect(
      stripTranslationMarkup(getBundledTranslationRaw('2:255', 'clear-quran')),
    ).toContain('His Seat\u00a0encompasses the heavens and the earth');
  });

  it('removes any other tag but keeps its text', () => {
    expect(
      stripTranslationMarkup('a <b>bold</b> and <i>slanted</i> word'),
    ).toBe('a bold and slanted word');
  });

  it('leaves text without markup alone, brackets and digits included', () => {
    const plain = '[All] praise is [due] to Allāh - 7 heavens, 2 seas.';
    expect(stripTranslationMarkup(plain)).toBe(plain);
    expect(stripTranslationMarkup('')).toBe('');
  });

  it('leaves no markup and no stray footnote number in either bundled translation', () => {
    const texts = [
      ...Object.values(saheeh).map(entry => entry.t),
      ...clearQuran.translations.map(entry => entry.text),
    ];
    // Both files really carry the markers this is about.
    expect(texts.filter(text => text.includes('<sup')).length).toBeGreaterThan(
      2000,
    );
    for (const text of texts) {
      const plain = stripTranslationMarkup(text);
      expect(plain).not.toMatch(/[<>]/);
      // The words on either side of a marker are kept, the number is not.
      expect(plain).toBe(text.replace(/<sup[^>]*>\d+<\/sup>/g, ''));
    }
  });
});

describe('bundled translation text', () => {
  it('Clear Quran rows carry no footnote number', () => {
    expect(getBundledTranslation('2:1', 'clear-quran')).toBe('Alif-Lãm-Mĩm.');
    expect(getBundledTranslation('1:2', 'clear-quran')).toBe(
      'All praise is for Allah—Lord of all worlds,',
    );
  });
});
