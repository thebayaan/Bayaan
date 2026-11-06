jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {trackFavoriteToggled: jest.fn()},
}));
const catalog = [
  {id: 'alafasy', name: 'Alafasy'},
  {id: 'husary', name: 'Husary'},
];
jest.mock('@/services/dataService', () => ({
  getAllReciters: jest.fn(async () => catalog),
  getReciterByIdSync: (id: string) => catalog.find(r => r.id === id),
}));

import {useFavoriteRecitersStore} from '@/services/player/store/favoriteRecitersStore';
import {useLovedStore} from '@/services/player/store/lovedStore';
import {
  createLibraryAdapter,
  watchLibraryEdits,
} from '@/services/library/qfLibraryAdapters';

describe('library adapter', () => {
  beforeEach(() => {
    useFavoriteRecitersStore.setState({
      favoriteReciterIds: [],
      favoriteReciters: {},
    });
    useLovedStore.setState({tracks: []});
  });

  it('reads favourites and loved tracks per surah, leaving uploads out', async () => {
    useFavoriteRecitersStore.getState().addFavoriteReciter(catalog[0] as never);
    const at =
      useFavoriteRecitersStore.getState().favoriteReciters.alafasy.favoritedAt;
    useLovedStore.setState({
      tracks: [
        {reciterId: 'alafasy', surahId: '18', rewayatId: 'hafs', timestamp: 5},
        {reciterId: 'alafasy', surahId: '18', rewayatId: 'warsh', timestamp: 6},
        {reciterId: 'husary', surahId: '1', rewayatId: '', timestamp: 7},
        {
          reciterId: 'me',
          surahId: '2',
          rewayatId: '',
          timestamp: 8,
          userRecitationId: 'u1',
        },
      ],
    });
    const local = await createLibraryAdapter().readLocal(new Map());
    expect(Object.fromEntries(local)).toEqual({
      reciters: {alafasy: String(at)},
      'loved-18': {'alafasy|hafs': '5', 'alafasy|warsh': '6'},
      'loved-1': {'husary|': '7'},
    });
  });

  it('applies remote favourites and keeps unknown reciters as present', async () => {
    const adapter = createLibraryAdapter();
    await adapter.readLocal(new Map([['reciters', {future: '1'}]]));
    expect(
      await adapter.applyLocal(
        'reciters',
        {future: '1'},
        {future: '1', husary: '3'},
      ),
    ).toBe(true);
    const state = useFavoriteRecitersStore.getState();
    expect(state.favoriteReciterIds).toEqual(['husary']);
    expect(state.favoriteReciters.husary.favoritedAt).toBe(3);
    // The reciter this catalog lacks still reads as a favourite, not a removal.
    const local = await adapter.readLocal(
      new Map([['reciters', {future: '1', husary: '3'}]]),
    );
    expect(local.get('reciters')).toEqual({future: '1', husary: '3'});
  });

  it('applies loved tracks for one surah without touching others or uploads', async () => {
    const upload = {
      reciterId: 'me',
      surahId: '18',
      rewayatId: '',
      timestamp: 1,
      userRecitationId: 'u',
    };
    const other = {
      reciterId: 'alafasy',
      surahId: '2',
      rewayatId: 'hafs',
      timestamp: 2,
    };
    useLovedStore.setState({
      tracks: [
        upload,
        other,
        {reciterId: 'alafasy', surahId: '18', rewayatId: 'hafs', timestamp: 3},
      ],
    });
    const adapter = createLibraryAdapter();
    await adapter.readLocal(new Map());
    expect(
      await adapter.applyLocal(
        'loved-18',
        {'alafasy|hafs': '3'},
        {'husary|warsh': '9'},
      ),
    ).toBe(true);
    expect(useLovedStore.getState().tracks).toEqual([
      {reciterId: 'husary', surahId: '18', rewayatId: 'warsh', timestamp: 9},
      other,
      upload,
    ]);
  });

  it('refuses to apply over an edit made since it read', async () => {
    const adapter = createLibraryAdapter();
    await adapter.readLocal(new Map());
    useLovedStore.setState({
      tracks: [
        {reciterId: 'alafasy', surahId: '18', rewayatId: 'hafs', timestamp: 3},
      ],
    });
    expect(await adapter.applyLocal('loved-18', {}, {'husary|': '1'})).toBe(
      false,
    );
  });

  it('reports user edits but not changes made by sync', async () => {
    jest.useFakeTimers();
    const onEdit = jest.fn();
    const stop = watchLibraryEdits(onEdit);
    const adapter = createLibraryAdapter();
    await adapter.readLocal(new Map());
    await adapter.applyLocal('loved-2', {}, {'alafasy|hafs': '1'});
    jest.advanceTimersByTime(2_000);
    expect(onEdit).not.toHaveBeenCalled();
    useLovedStore.getState().toggleLoved('husary', '3', 'hafs');
    useLovedStore.getState().toggleLoved('husary', '4', 'hafs');
    jest.advanceTimersByTime(2_000);
    expect(onEdit).toHaveBeenCalledTimes(1);
    stop();
    jest.useRealTimers();
  });
});
