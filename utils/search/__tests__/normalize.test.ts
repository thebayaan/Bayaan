// @ai-generated
import {
  ARABIC_MARKS, // @ai
  foldArabicLetters, // @ai
  foldHamzaCarriers, // @ai
  latinSkeleton,
  normalizeSearchText,
  toSearchKey,
  tokenize,
} from '../normalize';

describe('normalizeSearchText (unchanged contract)', () => {
  it.each([
    ['٢:٢٥٥', '2:255'],
    ['صَفْحَة ٢٢', 'صفحه 22'],
    ['جُزْء ٣٠', 'جزء 30'],
    ['الأَجْزَاء', 'الاجزاء'],
    ['  Mishary   Alafasi ', 'mishary alafasi'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeSearchText(input)).toBe(expected);
  });
});

describe('toSearchKey', () => {
  it.each([
    ['Al-Fatihah', 'al fatihah'],
    ["Hafs A'n Assem", 'hafs an assem'],
    ['Ya’qub', 'yaqub'],
    ['Al-Fatihah (1)', 'al fatihah 1'],
    ['Abdulbāsiṭ', 'abdulbasit'],
    ['المؤمنون', 'المومنون'],
    ['شاطئ', 'شاطي'],
    ['النبإ', 'النبا'],
    ['سماء', 'سما'],
    ['\u200f١١٢\u200f', '112'],
    ['ع\u200cبد', 'عبد'],
    ["'abd", 'abd'],
    ['!x', 'x'],
    ['   ', ''],
  ])('%s -> %s', (input, expected) => {
    expect(toSearchKey(input)).toBe(expected);
  });

  // @ai-start
  it('removes open tanween and the grapheme joiner inside a word', () => {
    // عَرَبِيࣰّا (12:2:4): U+08F0 used to split the word in two.
    expect(toSearchKey('ع\u{064E}ر\u{064E}ب\u{0650}ي\u{08F0}\u{0651}ا')).toBe(
      'عربيا',
    );
    expect(toSearchKey('ب\u{034F}ر')).toBe('بر');
    expect(normalizeSearchText('ع\u{064E}ر\u{064E}ب\u{0650}ي\u{08F0}ا')).toBe(
      'عربيا',
    );
  });
  // @ai-end
});

// @ai-start
describe('shared Arabic folds', () => {
  it('folds letters and hamza carriers like the catalogue keys', () => {
    expect(foldArabicLetters('ٱأإآ ىی ک ة')).toBe('اااا يي ك ه');
    expect(foldHamzaCarriers('مؤمن شاطئ سماء')).toBe('مومن شاطي سما');
  });

  it('lists every mark the keys drop', () => {
    const marks =
      '\u{034F}\u{0610}\u{064B}\u{0652}\u{0653}\u{0654}\u{0670}\u{06D6}\u{06DD}\u{06ED}\u{08F0}\u{08FF}\u{0640}';
    expect(`ب${marks}ر`.replace(ARABIC_MARKS, '')).toBe('بر');
    expect('ابجد'.replace(ARABIC_MARKS, '')).toBe('ابجد');
  });
});
// @ai-end

describe('tokenize', () => {
  it('splits keys on spaces and returns [] for empty keys', () => {
    expect(tokenize('al fatihah')).toEqual(['al', 'fatihah']);
    expect(tokenize('')).toEqual([]);
  });
});

describe('latinSkeleton', () => {
  it.each([
    ['hussary', 'husary'],
    ['hosary', 'husary'],
    ['mishary', 'mishari'],
    ['shuraim', 'shuraym'],
    ['minshawi', 'minshawy'],
    ['ghamdi', 'ghamidi'],
    ['abdulbasit', 'abdelbaset'],
    ['abdurrahman', 'abdalrahman'],
    ['alafasi', 'afasy'],
    ['qatami', 'katami'],
  ])('%s and %s share a skeleton', (a, b) => {
    expect(latinSkeleton(a)).toBe(latinSkeleton(b));
  });

  it('keeps the first letter even when it is a vowel', () => {
    expect(latinSkeleton('ajmy')).toBe('ajm');
    expect(latinSkeleton('yasin')).toBe('ysn');
  });

  it('leaves non-Latin tokens untouched', () => {
    expect(latinSkeleton('العفاسي')).toBe('العفاسي');
    expect(latinSkeleton('112')).toBe('112');
  });
});
