import {emptyStateCopy} from './emptyState';

describe('emptyStateCopy', () => {
  it('asks for the rest of a half-typed "surah …"', () => {
    expect(emptyStateCopy('surah').title).toBe('Now type the surah');
    expect(emptyStateCopy('Surah ').title).toBe('Now type the surah');
    expect(emptyStateCopy('سورة').title).toBe('Now type the surah');
  });

  it('says how many surahs there are for a number out of range', () => {
    expect(emptyStateCopy('115').title).toBe('There are 114 surahs');
    expect(emptyStateCopy('0').title).toBe('There are 114 surahs');
    expect(emptyStateCopy('200:1').title).toBe('There are 114 surahs');
    expect(emptyStateCopy('surah 300').title).toBe('There are 114 surahs');
  });

  it('says how many verses a surah has for a verse out of range', () => {
    expect(emptyStateCopy('2:300')).toEqual({
      title: 'Al-Baqarah has 286 verses',
      hint: 'Type a verse from 2:1 to 2:286.',
    });
    expect(emptyStateCopy('١١٢:٩').title).toBe('Al-Ikhlas has 4 verses');
  });

  it('says how many juz there are for a juz out of range', () => {
    expect(emptyStateCopy('juz 31').title).toBe('There are 30 juz');
    expect(emptyStateCopy('juz 0').title).toBe('There are 30 juz');
  });

  it('falls back to the generic copy, naming the query', () => {
    expect(emptyStateCopy(' xq ').title).toBe('No matches for “xq”');
  });
});
