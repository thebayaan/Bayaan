// @ai-generated
import {
  alifFreeKey,
  looseKey,
  matchKey,
  plainKey,
  plene,
  rasmLetters,
  searchKey,
} from '../word-study/arabic';

describe('matching keys', () => {
  it('reads the mushaf spelling as the standard one (plene)', () => {
    expect(matchKey('ٱلصَّلَوٰةَ')).toBe(matchKey('الصَّلَاةَ'));
    expect(matchKey('مَـٰلِكِ')).toBe(matchKey('مالك'));
    expect(matchKey('فَسَوَّىٰهُنَّ')).toBe(matchKey('فَسَوَّاهُنَّ'));
    expect(matchKey('إِبْرَٰهِـۧمَ')).toBe(matchKey('إِبْرَاهِيمَ'));
    expect(matchKey('نُـۨجِى')).toBe(matchKey('نُنجِي'));
    expect(matchKey('دَاوُۥدُ')).toBe(matchKey('داوود'));
  });

  it('keeps a word-final ىٰ and drops ṣila letters', () => {
    expect(plene('عَلَىٰ')).toBe('عَلَى');
    expect(matchKey('عَلَىٰ')).toBe(matchKey('عَلَى'));
    expect(matchKey('إِنَّهُۥ')).toBe(matchKey('إنه'));
    expect(matchKey('بِهِۦ')).toBe(matchKey('به'));
  });

  it('tries the span without plene too', () => {
    expect(plainKey('ذَٰلِكَ')).toBe(matchKey('ذلك'));
    expect(plainKey('ٱلرَّحْمَـٰنِ')).toBe(matchKey('الرَّحْمنِ'));
    expect(matchKey('ذَٰلِكَ')).not.toBe(matchKey('ذلك'));
  });

  it('folds hamza seats, alif forms and ta marbuta, and drops marks', () => {
    expect(searchKey('ٱلْأَرْضِ ۚ')).toBe('الارض');
    expect(searchKey('مُسْتَهْزِءُونَ')).toBe('مستهزون');
    expect(searchKey('يُؤْمِنُونَ')).toBe('يومنون');
    expect(searchKey('رَحْمَةٌ')).toBe('رحمه');
    expect(searchKey('۞ إِنَّ')).toBe('ان');
    expect(matchKey('لَا رَيْبَ ۛ فِيهِ ۛ')).toBe(matchKey('لاريب فيه'));
  });

  it('alif-free keys match a missing alif', () => {
    expect(alifFreeKey(matchKey('ٱلْكِتَـٰبُ'))).toBe(
      alifFreeKey(matchKey('الكتاب')),
    );
    expect(alifFreeKey(matchKey('أَزْوَٰجٌ'))).toBe(
      alifFreeKey(matchKey('أزواج')),
    );
  });
});

describe('looseKey', () => {
  it('matches a seatless hamza against a seat once the proclitic goes', () => {
    const word = 'وَيَسْتَنۢبِـُٔونَكَ';
    expect(looseKey(word.replace(/^وَ/, ''))).toBe(looseKey('يستنبئونك'));
    expect(looseKey(word)).toBe(looseKey('يستنبئونك'));
    expect(matchKey('يستنبئونك')).not.toBe(matchKey(word.replace(/^وَ/, '')));
  });

  it('reads the mushaf signs and merges doubled letters', () => {
    expect(looseKey('وَيَبْصُۜطُ')).toBe(looseKey('وَيَبْسُطُ'));
    expect(looseKey('نُـۨجِى')).toBe(looseKey('نُنجِي'));
    expect(looseKey('ٱلَّيْلِ')).toBe(looseKey('اللَّيْلِ'));
    expect(looseKey('يَبْنَؤُمَّ')).toBe(looseKey('يَا ابْنَ أُمَّ'));
    expect(looseKey('رَحْمَتَ')).toBe(looseKey('رحمة'));
  });

  it('drops a ن that merges into a following ل or م', () => {
    expect(looseKey('أَن لَّآ')).toBe(looseKey('أَلَّا'));
    expect(looseKey('وَأَلَّوِ')).toBe(looseKey('وَأَن لَّوِ'));
    expect(looseKey('عَن مَّا')).toBe(looseKey('عَمَّا'));
  });

  it('keeps ص without the small seen above', () => {
    expect(looseKey('بِمُصَيْطِرٍ')).not.toBe(looseKey('بمسيطر'));
    // The small seen below (52:37) keeps the ص reading, as Tanzil writes it.
    expect(looseKey('ٱلْمُصَۣيْطِرُونَ')).toBe(looseKey('الْمُصَيْطِرُونَ'));
  });
});

describe('rasmLetters', () => {
  const bases = (text: string) =>
    rasmLetters(text)
      .letters.map(l => l.base)
      .join('');

  it('marks ٰ directly on و as an alif written as waw', () => {
    const salah = rasmLetters('ٱلصَّلَوٰةَ');
    expect(salah.letters.map(l => l.hint)).toContain('wawAlif');
    expect(salah.gaps.flat()).toEqual([]);
    // و with its own fatha: ٰ is an alif after it, not a badal.
    const azwaj = rasmLetters('أَزْوَٰجٌ');
    expect(azwaj.letters.some(l => l.hint === 'wawAlif')).toBe(false);
    expect(azwaj.gaps[3].map(g => g.letter)).toEqual(['ا']);
  });

  it('marks ىٰ inside a word, not at its end', () => {
    expect(
      rasmLetters('فَسَوَّىٰهُنَّ').letters.find(l => l.raw === 'ى')?.hint,
    ).toBe('yaAlif');
    const ala = rasmLetters('عَلَىٰ');
    expect(ala.letters.map(l => l.hint)).toEqual([null, null, null]);
    expect(ala.gaps.flat()).toEqual([]);
  });

  it('sets zaid from ۟ and ۠', () => {
    const shay = rasmLetters('لِشَا۟ىْءٍ');
    expect(shay.letters.map(l => [l.base, l.zaid])).toEqual([
      ['ل', false],
      ['ش', false],
      ['ا', true],
      ['ي', false],
    ]);
    expect(shay.gaps[4].map(g => g.kind)).toEqual(['hamza']);
    expect(rasmLetters('لَأَا۟ذْبَحَنَّهُۥٓ').letters[2].zaid).toBe(true);
  });

  it('ignores ۥ and ۦ on ه (ṣila) but keeps small letters elsewhere', () => {
    const innahu = rasmLetters('إِنَّهُۥ');
    expect(innahu.gaps.flat()).toEqual([]);
    expect(innahu.letters.every(l => l.hint === null)).toBe(true);
    const ibrahim = rasmLetters('إِبْرَٰهِـۧمَ');
    expect(ibrahim.gaps.flat().map(g => g.letter)).toEqual(['ا', 'ي']);
    expect(ibrahim.gaps[3].map(g => g.letter)).toEqual(['ا']);
    expect(ibrahim.gaps[4].map(g => g.letter)).toEqual(['ي']);
    expect(rasmLetters('دَاوُۥدُ').gaps[3].map(g => g.letter)).toEqual(['و']);
  });

  it('reads a hamza with no seat as a gap sign', () => {
    const tasaloo = rasmLetters('تَسْـَٔلُوا۟');
    expect(bases('تَسْـَٔلُوا۟')).toBe('تسلوا');
    // ت َ س ْ ـ َ ٔ: the hamza mark (index 6) sits on the tatweel.
    expect(tasaloo.gaps[2]).toEqual([
      {kind: 'hamza', letter: 'ء', start: 6, end: 7, word: 0},
    ]);
    // ٔ after a ٰ on ر (2:72): the ٰ is the omitted alif, the hamza has no seat.
    const addara = rasmLetters('فَٱدَّٰرَْٰٔتُمْ');
    expect(addara.letters.every(l => !l.hamza)).toBe(true);
    expect(addara.gaps[4].map(g => g.letter)).toEqual(['ا', 'ء']);
    expect(rasmLetters('مُسْتَهْزِءُونَ').gaps[5].map(g => g.letter)).toEqual([
      'ء',
    ]);
  });

  it('reads آ as a madd in the mushaf and as a hamza in the standard text', () => {
    expect(rasmLetters('جَآءَ').letters[1]).toMatchObject({
      base: 'ا',
      hamza: false,
    });
    expect(rasmLetters('آمَنُوا', 'imlaei').letters[0]).toMatchObject({
      base: 'ا',
      raw: 'آ',
      hamza: true,
    });
  });

  it('folds seats and dotless ya; composes a decomposed seat', () => {
    expect(bases('سَآئِلٌۢ')).toBe('سايل');
    expect(rasmLetters('سَآئِلٌۢ').letters[2]).toMatchObject({
      raw: 'ئ',
      hamza: true,
    });
    expect(rasmLetters('سَألَ').letters[1].raw).toBe('أ');
  });

  it('marks the small seen on ص only', () => {
    expect(
      rasmLetters('وَيَبْصُۜطُ').letters.find(l => l.raw === 'ص')?.hint,
    ).toBe('seen');
    expect(rasmLetters('عِوَجَاۜ').letters.every(l => l.hint === null)).toBe(
      true,
    );
    expect(
      rasmLetters('ٱلْمُصَۣيْطِرُونَ').letters.every(l => l.hint === null),
    ).toBe(true);
  });

  it('gives offsets of each letter with its marks', () => {
    const malik = rasmLetters('مَالِكِ', 'imlaei');
    expect(malik.letters.map(l => [l.raw, l.start, l.end])).toEqual([
      ['م', 0, 2],
      ['ا', 2, 3],
      ['ل', 3, 5],
      ['ك', 5, 7],
    ]);
    // ٰ is a sign of its own, not part of the letter before it.
    const mushaf = rasmLetters('مَـٰلِكِ');
    expect(mushaf.letters[0].end).toBe(2);
    expect(mushaf.gaps[1]).toEqual([
      {kind: 'small', letter: 'ا', start: 3, end: 4, word: 0},
    ]);
  });

  it('counts written words and skips pause signs and ۞', () => {
    expect(rasmLetters('بَعْدَ مَا').words).toBe(2);
    expect(rasmLetters('۞ إِنَّ').words).toBe(1);
    expect(rasmLetters('رَيْبَ ۛ').words).toBe(1);
    expect(rasmLetters('ٱلْعَظِيمِ ۩‏').words).toBe(1);
  });
});
