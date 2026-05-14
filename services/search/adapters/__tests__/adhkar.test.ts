import {
  buildAdhkarCategoryIndex,
  adhkarCategoryToResult,
  loadAdhkarCategories,
} from '../adhkar';

describe('adhkar category adapter', () => {
  const cats = loadAdhkarCategories();
  const idx = buildAdhkarCategoryIndex(cats);

  it('matches morning', () => {
    const hits = idx.search('morning');
    expect(hits.length).toBeGreaterThan(0);
    const top = idx.byId.get(hits[0].id);
    expect(top?.title.toLowerCase()).toContain('morning');
  });

  it('matches by tag', () => {
    const hits = idx.search('daily');
    expect(hits.length).toBeGreaterThan(0);
  });
});
