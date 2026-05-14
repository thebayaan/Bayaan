import {parseRef} from '../refParser';

describe('parseRef', () => {
  it('parses a verse reference', () => {
    const refs = parseRef('2:255');
    expect(refs).toEqual([
      {kind: 'verse', surah: 2, ayah: 255, label: 'The Cow 2:255'},
    ]);
  });

  it('parses page references', () => {
    expect(parseRef('page 100')).toEqual([
      {kind: 'page', page: 100, label: 'Page 100'},
    ]);
    expect(parseRef('pg 1')).toEqual([
      {kind: 'page', page: 1, label: 'Page 1'},
    ]);
  });

  it('parses juz references', () => {
    expect(parseRef('juz 30')).toEqual([
      {kind: 'juz', juz: 30, label: 'Juz 30'},
    ]);
    expect(parseRef('amma')).toEqual([
      {kind: 'juz', juz: 30, label: 'Juz 30 (Amma)'},
    ]);
    expect(parseRef('tabarak')).toEqual([
      {kind: 'juz', juz: 29, label: 'Juz 29 (Tabarak)'},
    ]);
  });

  it('parses plain numbers as multi-candidate', () => {
    const refs = parseRef('30');
    expect(refs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({kind: 'surah', surah: 30}),
        expect.objectContaining({kind: 'juz', juz: 30}),
        expect.objectContaining({kind: 'page', page: 30}),
      ]),
    );
  });

  it('rejects out-of-range numbers', () => {
    expect(parseRef('999')).toEqual([]);
  });

  it('returns empty for non-numeric input', () => {
    expect(parseRef('Yasin')).toEqual([]);
  });

  it('rejects invalid verse refs', () => {
    expect(parseRef('999:1')).toEqual([]);
    expect(parseRef('1:999')).toEqual([]);
  });
});
