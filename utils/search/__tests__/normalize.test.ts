// @ai-generated
import {
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
});

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
