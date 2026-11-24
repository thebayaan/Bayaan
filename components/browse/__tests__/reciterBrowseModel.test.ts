// @ai-generated
import type {Reciter} from '@/data/reciterData';

jest.mock('@/utils/search/catalog', () => ({
  rankReciters: (query: string, within: Reciter[]) =>
    within.filter(r => r.name.toLowerCase().includes(query.toLowerCase())),
}));
jest.mock('@/i18n/format', () => ({
  getReciterDisplayName: (r: {name: string}) => r.name,
}));
jest.mock('@/services/rewayah/RewayahIdentity', () => {
  const ids: Record<string, string> = {
    "Hafs A'n Assem": 'hafs',
    "Warsh A'n Nafi'": 'warsh',
    "Aldori A'n Abi Amr": 'al-duri-abi-amr',
    "AlDorai A'n Al-Kisa'ai": 'al-duri-al-kisai',
  };
  const narrator: Record<string, string> = {
    hafs: 'Hafs',
    warsh: 'Warsh',
    'al-duri-abi-amr': 'Al-Duri',
    'al-duri-al-kisai': 'Al-Duri',
  };
  return {
    resolveRewayahFromName: (name: string) => ids[name] ?? null,
    getNarratorLabel: (id: string) => narrator[id],
    getShortLabel: (id: string) => `short:${id}`,
  };
});

import {
  buildBrowseItems,
  filterReciters,
  letterSections,
  reciterLine,
  rewayahChipLabel,
  rewayahCounts,
} from '../reciterBrowseModel';

const all = Array.from({length: 114}, (_, i) => i + 1);
function reciter(
  id: string,
  name: string,
  rewayat: [string, number[]][],
  date = '2024-01-01',
): Reciter {
  return {
    id,
    name,
    date,
    image_url: null,
    rewayat: rewayat.map(([rname, list], i) => ({
      id: `${id}-${i}`,
      reciter_id: id,
      name: rname,
      style: 'murattal',
      server: '',
      surah_total: list.length,
      surah_list: list,
      source_type: '',
      created_at: '',
    })),
  };
}

const a = reciter('a', 'Ahmad', [["Hafs A'n Assem", all]], '2023-01-01');
const b = reciter('b', 'Basfar', [
  ["Hafs A'n Assem", all],
  ["Warsh A'n Nafi'", [1, 2, 3]],
]);
const c = reciter('c', 'Ali', [["Warsh A'n Nafi'", [1, 36]]], '2025-05-01');
const none = new Set<string>();

it('counts rewayat, most recorded first', () => {
  expect(rewayahCounts([a, b, c])).toEqual([
    {id: 'hafs', count: 2},
    {id: 'warsh', count: 2},
  ]);
});

it('names a chip by its narrator unless two chips share one', () => {
  expect(rewayahChipLabel('warsh' as never, ['hafs', 'warsh'] as never)).toBe(
    'Warsh',
  );
  expect(
    rewayahChipLabel(
      'al-duri-abi-amr' as never,
      ['al-duri-abi-amr', 'al-duri-al-kisai'] as never,
    ),
  ).toBe('short:al-duri-abi-amr');
});

it('lists rewayat and adds the surah count only for partial reciters', () => {
  const label = (n: number) => `${n} surahs`;
  expect(reciterLine(a, label)).toBe('Hafs');
  expect(reciterLine(b, label)).toBe('Hafs, Warsh');
  expect(reciterLine(c, label)).toBe('Warsh · 2 surahs');
});

it('filters by rewayah, complete Quran and downloads', () => {
  const base = {
    query: '',
    rewayah: null,
    completeOnly: false,
    downloadedOnly: false,
    downloadedIds: none,
  };
  expect(
    filterReciters([a, b, c], {...base, rewayah: 'warsh' as never}, 'name').map(
      r => r.id,
    ),
  ).toEqual(['c', 'b']);
  expect(
    filterReciters([a, b, c], {...base, completeOnly: true}, 'name').map(
      r => r.id,
    ),
  ).toEqual(['a', 'b']);
  expect(
    filterReciters(
      [a, b, c],
      {...base, downloadedOnly: true, downloadedIds: new Set(['c'])},
      'name',
    ).map(r => r.id),
  ).toEqual(['c']);
});

it('sorts by name or by newest, and keeps match order for a query', () => {
  const base = {
    query: '',
    rewayah: null,
    completeOnly: false,
    downloadedOnly: false,
    downloadedIds: none,
  };
  expect(filterReciters([b, c, a], base, 'name').map(r => r.id)).toEqual([
    'a',
    'c',
    'b',
  ]);
  expect(filterReciters([a, b, c], base, 'recent').map(r => r.id)).toEqual([
    'c',
    'b',
    'a',
  ]);
  expect(
    filterReciters([a, b, c], {...base, query: 'al'}, 'name').map(r => r.id),
  ).toEqual(['c']);
});

it('groups by letter and lays out rows or cards', () => {
  const sections = letterSections([a, c, b], true);
  expect(sections.map(s => s.letter)).toEqual(['A', 'B']);
  const rows = buildBrowseItems(sections, 'list', 3);
  expect(rows.map(i => i.type)).toEqual([
    'header',
    'row',
    'row',
    'header',
    'row',
  ]);
  expect(rows[1]).toMatchObject({first: true, last: false});
  expect(rows[2]).toMatchObject({first: false, last: true});
  const cards = buildBrowseItems(letterSections([a, b, c], false), 'cards', 2);
  expect(cards.map(i => (i.type === 'cards' ? i.reciters.length : 0))).toEqual([
    2, 1,
  ]);
});
