import {buildNamesIndex, loadAsma} from '../names';

describe('names adapter', () => {
  const rows = loadAsma();
  const idx = buildNamesIndex(rows);

  it('seeds at least 99 entries', () => {
    expect(rows.length).toBeGreaterThanOrEqual(99);
  });

  it('matches Ar-Rahman by transliteration', () => {
    const hits = idx.search('Rahman');
    expect(hits[0].id).toBe('name:1');
  });

  it('matches by Arabic', () => {
    const hits = idx.search('الرحمن');
    expect(hits[0].id).toBe('name:1');
  });

  it('matches by meaning', () => {
    const hits = idx.search('merciful');
    expect(hits.find(h => h.id === 'name:1')).toBeDefined();
  });
});
