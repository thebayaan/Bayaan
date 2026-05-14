import {buildSurahIndex, surahToResult} from '../surah';
import {SURAHS} from '@/data/surahData';

describe('surah adapter', () => {
  const idx = buildSurahIndex(SURAHS);

  it('matches Al-Fatihah by name', () => {
    const hits = idx.search('fatiha');
    expect(hits[0].id).toBe('surah:1');
  });

  it('matches Yasin via alias', () => {
    const hits = idx.search('yaseen');
    expect(hits[0].id).toBe('surah:36');
  });

  it('matches Ya-Sin by Arabic', () => {
    const hits = idx.search('يس');
    expect(hits[0].id).toBe('surah:36');
  });

  it('surahToResult produces correct shape', () => {
    const surah = SURAHS.find(s => s.id === 36)!;
    const r = surahToResult(surah, {
      textualScore: 1,
      personalBoost: 0,
      contextualBoost: 0,
      finalScore: 1,
      tier: 'exact',
      matchedField: 'name',
      matchedRange: [0, 5],
      signal: null,
    });
    expect(r.type).toBe('surah');
    expect(r.title).toContain('Ya');
  });
});
