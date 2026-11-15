import {rootLetters, rootType, times} from '../irab/sarf';
import {bare, ending} from '../irab/irabText';

describe('rootLetters', () => {
  it('maps the corpus Buckwalter root to Arabic (A is hamza)', () => {
    expect(rootLetters('ktb')).toEqual(['ك', 'ت', 'ب']);
    expect(rootLetters('Amn')).toEqual(['ء', 'م', 'ن']);
    expect(rootLetters('$y?')).toBeNull();
  });
});

describe('rootType', () => {
  it.each([
    ['ktb', 'صحيح سالم'],
    ['rbb', 'صحيح مضعف'],
    ['Amn', 'صحيح مهموز الفاء'],
    ['sAl', 'صحيح مهموز العين'],
    ['qrA', 'صحيح مهموز اللام'],
    ['wEd', 'معتل مثال واوي'],
    ['ysr', 'معتل مثال يائي'],
    ['qwl', 'معتل أجوف واوي'],
    ['byE', 'معتل أجوف يائي'],
    ['dEw', 'معتل ناقص واوي'],
    ['hdy', 'معتل ناقص يائي'],
    ['wqy', 'معتل لفيف مفروق'],
    ['Twy', 'معتل لفيف مقرون'],
    ['rAy', 'معتل ناقص يائي، مهموز العين'],
    ['$yA', 'معتل أجوف يائي، مهموز اللام'],
    ['zlzl', 'رباعي مضعف'],
  ])('%s → %s', (root, type) => {
    expect(rootType(root)).toBe(type);
  });
});

describe('times', () => {
  it('uses Arabic number agreement and Arabic-Indic digits', () => {
    expect(times(1)).toBe('مرة واحدة');
    expect(times(2)).toBe('مرتين');
    expect(times(7)).toBe('٧ مرات');
    expect(times(2851)).toBe('٢٨٥١ مرة');
  });
});

describe('ending', () => {
  it('reads a dotless final ya after kasra as ya, not alif', () => {
    expect(ending('تَجْرِى').type).toBe('ya');
    expect(ending('مُوسَىٰ').type).toBe('alif');
    expect(ending('هُدًى').type).toBe('alif');
    expect(ending('ٱلْكِتَـٰبُ')).toMatchObject({type: 'vowel', vowel: 'u'});
  });

  it('bare drops all marks', () => {
    expect(bare('ٱلصَّـٰلِحَـٰتِ')).toBe('ٱلصلحت');
  });
});
