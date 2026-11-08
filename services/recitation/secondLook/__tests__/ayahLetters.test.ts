import {createHash} from 'crypto';
import {SURAHS} from '@/data/surahData';
import {ayahLetters, lettersOf} from '../ayahLetters';

describe('ayahLetters', () => {
  it('gives each engine word its letters', () => {
    expect(ayahLetters(1, 1)).toEqual(['بسم', 'الله', 'الرحمن', 'الرحيم']);
    expect(ayahLetters(2, 1)).toEqual(['الم']);
    expect(ayahLetters(36, 1)).toEqual(['يس']);
  });

  it('leaves out the ayah number, the rub sign and the stop signs', () => {
    // Opens with the rub sign and has stop signs on three words.
    const words = ayahLetters(2, 26);
    expect(words).toHaveLength(39);
    expect(words?.[0]).toBe('ان');
    expect(words?.[10]).toBe('فوقها');
    expect(words?.[38]).toBe('الفسقين');
    // Ends with the sajdah sign.
    const sajdah = ayahLetters(32, 15);
    expect(sajdah).toHaveLength(15);
    expect(sajdah?.[14]).toBe('يستكبرون');
  });

  it.each([
    [15, 7],
    [27, 20],
    [36, 22],
  ])('%i:%i, where the engine splits a word in two, has none', (s, a) => {
    expect(ayahLetters(s, a)).toBeNull();
  });

  it('the ayat around those are not affected', () => {
    expect(ayahLetters(15, 6)).toHaveLength(8);
    expect(ayahLetters(15, 8)).toHaveLength(9);
  });

  it.each([
    [0, 1],
    [1, 0],
    [1, 8],
    [115, 1],
  ])('%i:%i is no ayah', (s, a) => {
    expect(ayahLetters(s, a)).toBeNull();
  });

  // The official KFGQPC file gave this hash on the same words (the one-off
  // check also compared all 6,236 ayat word by word: no differences). A change
  // to data/quran.json or to the recipe shows up here.
  it('all the letters hash to the pinned value', () => {
    const hash = createHash('sha256');
    let ayat = 0;
    let words = 0;
    for (const surah of SURAHS) {
      for (let ayah = 1; ayah <= surah.verses_count; ayah++) {
        const letters = ayahLetters(surah.id, ayah);
        if (!letters) continue;
        hash.update(`${surah.id}:${ayah} ${letters.join(' ')}\n`, 'utf8');
        ayat += 1;
        words += letters.length;
      }
    }
    expect(ayat).toBe(6233);
    expect(words).toBe(77405);
    expect(hash.digest('hex')).toBe(
      '7cc2afe1a246aeed55823a9d70084207da6bb14c41e2d06537d23e62ce3d6b2c',
    );
  });
});

describe('lettersOf', () => {
  it('drops the marks and folds the letter forms, as the model was labelled', () => {
    expect(lettersOf('ٱلرَّحۡمَٰنِ')).toBe('الرحمن');
    expect(lettersOf('بَعُوضَةٗ')).toBe('بعوضه');
    expect(lettersOf('يُؤۡمِنُ')).toBe('يومن');
    expect(lettersOf('عَلَىٰ')).toBe('علي');
    expect(lettersOf('إِنَّ')).toBe('ان');
    expect(lettersOf('ٱلَّذِيٓ')).toBe('الذي');
    expect(lettersOf('بِـَٔايَٰتِنَا')).toBe('بايتنا');
    expect(lettersOf('ءَامَنُواْ')).toBe('ءامنوا');
  });

  it('gives nothing for what is not a word', () => {
    expect(lettersOf('٢٦')).toBe('');
    expect(lettersOf('۞')).toBe('');
    expect(lettersOf('۩')).toBe('');
  });
});
