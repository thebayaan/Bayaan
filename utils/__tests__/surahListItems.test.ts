// @ai-generated
import {SURAHS} from '@/data/surahData';
import {buildSurahListItems, type SurahListItem} from '@/utils/surahListItems';

const ids = (item: SurahListItem) =>
  item.type === 'surah-row' ? item.surahs.map(s => s.id) : `juz ${item.juz}`;

it('keeps one surah per row with juz headers on phones', () => {
  const {items, stickyIndices} = buildSurahListItems(SURAHS, {
    viewMode: 'list',
    numColumns: 1,
    juzHeaders: true,
  });
  expect(items.slice(0, 4).map(ids)).toEqual(['juz 1', [1], [2], 'juz 3']);
  expect(items[1].key).toBe('surah-1');
  expect(stickyIndices.slice(0, 2)).toEqual([0, 3]);
  expect(stickyIndices.every(i => items[i].type === 'juz-header')).toBe(true);
  expect(items.filter(item => item.type === 'surah-row')).toHaveLength(114);
});

it('flows two to a row and labels the surah that starts each juz', () => {
  const {items, stickyIndices} = buildSurahListItems(SURAHS, {
    viewMode: 'list',
    numColumns: 2,
    juzHeaders: true,
  });
  expect(stickyIndices).toEqual([]);
  expect(items.every(item => item.type === 'surah-row')).toBe(true);
  expect(items).toHaveLength(57);
  const rows = items.flatMap(item => (item.type === 'surah-row' ? [item] : []));
  // Al-Fatihah opens Juz 1; Al-Baqarah carries on in it.
  expect(rows[0].juzStarts).toEqual([1, null]);
  // Juz 3 and 4 each start with a single surah, side by side.
  expect(rows[1].surahs.map(s => s.id)).toEqual([3, 4]);
  expect(rows[1].juzStarts).toEqual([3, 4]);
  // Juz 30 starts at An-Naba (78); the rows after it carry no labels.
  const amma = rows.find(row => row.juzStarts?.includes(30));
  expect(amma?.surahs.map(s => s.id)).toEqual([77, 78]);
  expect(amma?.juzStarts).toEqual([null, 30]);
  expect(rows[rows.length - 1].juzStarts).toBeUndefined();
  expect(rows.flatMap(row => row.surahs).map(s => s.id)).toEqual(
    SURAHS.map(s => s.id),
  );
});

it('labels the first surah of each juz it meets when sorted descending', () => {
  const {items} = buildSurahListItems([...SURAHS].reverse(), {
    viewMode: 'list',
    numColumns: 2,
    juzHeaders: true,
  });
  const first = items[0];
  expect(first.type === 'surah-row' && first.juzStarts).toEqual([30, null]);
});

it('has no headers when sorted by revelation or in the grid', () => {
  for (const options of [
    {viewMode: 'list' as const, numColumns: 2, juzHeaders: false},
    {viewMode: 'card' as const, numColumns: 5, juzHeaders: true},
  ]) {
    const {items, stickyIndices} = buildSurahListItems(SURAHS, options);
    expect(stickyIndices).toEqual([]);
    expect(items.every(item => item.type === 'surah-row')).toBe(true);
  }
  const grid = buildSurahListItems(SURAHS, {
    viewMode: 'card',
    numColumns: 5,
    juzHeaders: false,
  });
  expect(grid.items[0].key).toBe('card-1-2-3-4-5');
  expect(grid.items).toHaveLength(23);
});
