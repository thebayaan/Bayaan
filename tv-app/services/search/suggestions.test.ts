import {SURAHS} from '../../../data/surahData';
import {
  buildSuggestions,
  highlightRange,
  splitLabel,
  verseLabel,
} from './suggestions';
import type {RankedItem} from './tvSearch';
import {
  deleteKey,
  keyRows,
  KEY_COLUMNS,
  MAX_QUERY_CHARS,
  modeKeyLabel,
  nextMode,
  typeKey,
  typeSpace,
} from './keyboard';

const surah = (id: number) => SURAHS.find(s => s.id === id)!;

function mark(label: string, query: string): string {
  const range = highlightRange(label, query);
  return range ? label.slice(...range) : '';
}

describe('highlightRange', () => {
  it('marks the typed part at a word start', () => {
    expect(mark('Ash-Sharh', 'sh')).toBe('Sh');
    expect(mark('Abu Bakr Al-Shatri', 'shat')).toBe('Shat');
    expect(mark('Al-Mulk', 'mulk')).toBe('Mulk');
  });

  it('spans punctuation the query wrote as a space', () => {
    expect(mark('Al-Mulk', 'al mulk')).toBe('Al-Mulk');
    expect(mark('Ayat al-Kursi · 2:255', '2:255')).toBe('2:255');
  });

  it('ignores case and accents', () => {
    expect(mark('Ṭā Hā', 'ta')).toBe('Ṭā');
  });

  it('falls back to the query without its article', () => {
    expect(mark('Mulk', 'al mulk')).toBe('Mulk');
  });

  it('returns null for a variant with no literal overlap', () => {
    expect(highlightRange('Mahmoud Khalil Al-Hussary', 'hosary')).toBeNull();
  });
});

describe('splitLabel', () => {
  it('splits around the match', () => {
    expect(splitLabel('Ash-Sharh', [4, 6])).toEqual({
      before: 'Ash-',
      match: 'Sh',
      after: 'arh',
    });
    expect(splitLabel('Ya-Sin', null)).toEqual({
      before: 'Ya-Sin',
      match: '',
      after: '',
    });
  });
});

describe('buildSuggestions', () => {
  const ranked: RankedItem[] = [
    {type: 'surah', item: surah(94), score: 90},
    {type: 'surah', item: surah(94), score: 80},
    {
      type: 'verse',
      item: {surah: surah(2), ayah: 255, name: 'Ayat al-Kursi'},
      score: 70,
    },
    {
      type: 'verse',
      item: {surah: surah(18), ayah: 10, name: null},
      score: 60,
    },
  ];

  it('dedupes, tags and fills', () => {
    const got = buildSuggestions('sh', ranked);
    expect(got.map(s => [s.label, s.kind, s.fill])).toEqual([
      ['Ash-Sharh', 'Surah', 'Ash-Sharh'],
      ['Ayat al-Kursi · 2:255', 'Verse', 'Ayat al-Kursi'],
      ['Al-Kahf · 18:10', 'Verse', '18:10'],
    ]);
  });

  it('respects the limit and an empty query', () => {
    expect(buildSuggestions('sh', ranked, 1)).toHaveLength(1);
    expect(buildSuggestions('  ', ranked)).toEqual([]);
  });

  it('labels verses with their reference', () => {
    expect(verseLabel({surah: surah(1), ayah: 1, name: null})).toBe(
      'Al-Fatihah · 1:1',
    );
  });
});

describe('keyboard', () => {
  it('keeps every layout on the same 7 x 4 grid', () => {
    for (const mode of ['letters', 'numbers', 'arabic'] as const) {
      const rows = keyRows(mode);
      expect(rows).toHaveLength(4);
      rows.forEach(row => expect(row).toHaveLength(KEY_COLUMNS));
    }
  });

  it('has every letter, digit and the verse separator', () => {
    const letters = keyRows('letters').flat().join('');
    expect(letters).toContain('abcdefghijklmnopqrstuvwxyz');
    const numbers = keyRows('numbers').flat().join('');
    for (const c of '0123456789:') expect(numbers).toContain(c);
  });

  it('cycles modes and labels the key with the next one', () => {
    expect(nextMode('letters')).toBe('numbers');
    expect(nextMode('numbers')).toBe('arabic');
    expect(nextMode('arabic')).toBe('letters');
    expect(modeKeyLabel('letters')).toBe('123');
    expect(modeKeyLabel('arabic')).toBe('abc');
  });

  it('edits the query', () => {
    expect(typeKey('ka', 'h')).toBe('kah');
    expect(typeKey('ka', '')).toBe('ka');
    expect(typeKey('x'.repeat(MAX_QUERY_CHARS), 'y')).toHaveLength(
      MAX_QUERY_CHARS,
    );
    expect(typeSpace('')).toBe('');
    expect(typeSpace('al')).toBe('al ');
    expect(typeSpace('al ')).toBe('al ');
    expect(deleteKey('kahf')).toBe('kah');
    expect(deleteKey('')).toBe('');
  });
});
