// @ai-generated
/**
 * A favourite is saved as a copy of the reciter as it was on the day it was
 * favourited. Favourites and the Home favourites row showed that copy, so a
 * reciter whose photo, name or rewayat changed in the catalogue kept the old
 * ones there for good. The hook now reads each favourite from the catalogue.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {
  RECITERS,
  markRecitersUpdated,
  type Reciter,
  type Rewayat,
} from '@/data/reciterData';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => ({})},
}));
jest.mock('@/utils/search/catalog', () => ({rankSurahs: () => []}));
jest.mock('@/data/reciters-fallback.json', () => []);

import {useFavoriteReciters} from '../useFavoriteReciters';
import {useFavoriteRecitersStore} from '@/services/player/store/favoriteRecitersStore';
import {useReciterStore} from '@/store/reciterStore';

type Favorites = ReturnType<typeof useFavoriteReciters>;

let favorites!: Favorites;
let renders = 0;
let renderer: TestRenderer.ReactTestRenderer | null = null;

function Probe() {
  favorites = useFavoriteReciters();
  renders += 1;
  return null;
}

const rewayah = (reciterId: string, name: string): Rewayat => ({
  id: `${reciterId}-${name}`,
  reciter_id: reciterId,
  name,
  style: 'murattal',
  server: `https://cdn.example.test/${reciterId}/${name}/`,
  surah_total: 1,
  surah_list: [1],
  source_type: 'test',
  created_at: '2026-01-01',
});

const reciter = (
  id: string,
  name: string,
  image: string,
  rewayat: string[],
): Reciter => ({
  id,
  name,
  date: null,
  image_url: image,
  rewayat: rewayat.map(r => rewayah(id, r)),
});

const AS_FAVORITED = reciter('r1', 'Old Name', 'https://old.test/r1.jpg', [
  'hafs',
]);
const IN_CATALOGUE = reciter('r1', 'New Name', 'https://new.test/r1.jpg', [
  'hafs',
  'warsh',
]);

/** What dataService does each time it refills the catalogue. */
function loadCatalogue(reciters: Reciter[]) {
  RECITERS.splice(0, RECITERS.length, ...reciters);
  markRecitersUpdated();
  useReciterStore.getState().catalogLoaded();
}

function mount() {
  act(() => {
    renderer = TestRenderer.create(<Probe />);
  });
}

beforeEach(() => {
  RECITERS.splice(0, RECITERS.length);
  useFavoriteRecitersStore.getState().reset();
  jest.spyOn(Date, 'now').mockReturnValue(1000);
  useFavoriteRecitersStore.getState().addFavoriteReciter(AS_FAVORITED);
});

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  jest.restoreAllMocks();
});

it('shows a favourite as the catalogue has it now', () => {
  loadCatalogue([IN_CATALOGUE]);
  mount();

  expect(favorites.favoriteReciters).toEqual([
    {...IN_CATALOGUE, favoritedAt: 1000},
  ]);
});

it('shows the saved copy for a reciter the catalogue no longer lists', () => {
  loadCatalogue([reciter('other', 'Other', 'https://new.test/o.jpg', [])]);
  mount();

  expect(favorites.favoriteReciters).toEqual([
    {...AS_FAVORITED, favoritedAt: 1000},
  ]);
});

it('picks up a catalogue that loads or changes while the screen is open', () => {
  mount();
  expect(favorites.favoriteReciters[0].name).toBe('Old Name');

  act(() => loadCatalogue([IN_CATALOGUE]));
  expect(favorites.favoriteReciters[0].name).toBe('New Name');
  expect(favorites.favoriteReciters[0].rewayat).toHaveLength(2);

  const renamed = {...IN_CATALOGUE, name: 'Newer Name'};
  act(() => loadCatalogue([renamed]));
  expect(favorites.favoriteReciters[0].name).toBe('Newer Name');
});

it('hands back the same list until the favourites or the catalogue change', () => {
  loadCatalogue([IN_CATALOGUE]);
  mount();
  const first = favorites.favoriteReciters;

  // The reciter store changing for any other reason is not a catalogue refill.
  const before = renders;
  act(() => useReciterStore.setState({isInitialized: true}));
  expect(renders).toBe(before);

  act(() => renderer?.update(<Probe />));
  expect(favorites.favoriteReciters).toBe(first);
});

it('keeps favourites in the order they were added', () => {
  const second = reciter('r2', 'Second', 'https://new.test/r2.jpg', ['hafs']);
  loadCatalogue([second, IN_CATALOGUE]);
  mount();

  act(() => favorites.addFavorite(second));

  expect(favorites.favoriteReciters.map(r => r.id)).toEqual(['r1', 'r2']);
});

it('still saves the whole reciter, as existing installs have it', () => {
  loadCatalogue([IN_CATALOGUE]);
  mount();

  const state = useFavoriteRecitersStore.getState();
  expect(state.favoriteReciterIds).toEqual(['r1']);
  expect(state.favoriteReciters).toEqual({
    r1: {...AS_FAVORITED, favoritedAt: 1000},
  });
});
