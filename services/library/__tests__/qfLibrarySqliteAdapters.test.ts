// @ai-generated
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    trackPlaylistModified: jest.fn(),
    trackFavoriteToggled: jest.fn(),
  },
}));
jest.mock('@/services/dataService', () => ({
  getAllReciters: jest.fn(async () => []),
  getReciterByIdSync: () => undefined,
}));
jest.mock('@/services/adhkar/AdhkarService', () => {
  const {adhkarDatabaseService} = jest.requireActual(
    '@/services/database/AdhkarDatabaseService',
  );
  const ready = () => adhkarDatabaseService.initialize();
  return {
    adhkarService: {
      getSaved: async () => (await ready(), adhkarDatabaseService.getSaved()),
      toggleSaved: async (id: string) => (
        await ready(),
        adhkarDatabaseService.toggleSaved(id)
      ),
      replaceSaved: async (e: Record<string, number>, n: unknown[]) => (
        await ready(),
        adhkarDatabaseService.replaceSaved(e, n)
      ),
    },
  };
});

import {databaseService} from '@/services/database/DatabaseService';
import {playlistService} from '@/services/playlist/PlaylistService';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {usePlaylistsStore} from '@/store/playlistsStore';
import {useAdhkarStore} from '@/store/adhkarStore';
import {
  createAdhkarAdapter,
  createPlaylistsAdapter,
} from '@/services/library/qfLibraryAdapters';
import {onLibraryEdited} from '@/services/library/libraryEdits';

describe('playlists adapter', () => {
  it('reads playlists in play order, without upload items', async () => {
    // Item ids come from Date.now(), so keep them apart.
    let now = 1_790_000_000_000;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => ++now);
    const playlist = await playlistService.createPlaylist(
      'Morning',
      '#fff',
      '',
    );
    await playlistService.addToPlaylist(playlist.id, '18', 'alafasy', 'hafs');
    await playlistService.addToPlaylist(
      playlist.id,
      '2',
      'me',
      undefined,
      'upload-1',
    );
    await playlistService.addToPlaylist(playlist.id, '36', 'husary');
    const local = await createPlaylistsAdapter().readLocal(new Map());
    const entries = local.get(playlist.id)!;
    expect(entries.name).toBe('Morning');
    expect(entries.description).toBe('null');
    const shown = await playlistService.getPlaylistItems(playlist.id);
    const expectedOrder = shown
      .filter(item => !item.userRecitationId)
      .map(item => [
        Number(item.surahId),
        item.reciterId,
        item.rewayatId ?? '',
      ]);
    expect(JSON.parse(entries.items)).toEqual(expectedOrder);
    expect(expectedOrder).toHaveLength(2);
    clock.mockRestore();
  });

  it('creates, replaces (keeping uploads) and deletes from sync', async () => {
    const adapter = createPlaylistsAdapter();
    const items = JSON.stringify([
      [1, 'a', 'hafs'],
      [2, 'b', ''],
    ]);
    const next = {
      name: 'Synced',
      color: '#000',
      description: '"desc"',
      createdAt: '5',
      items,
    };
    expect(await adapter.applyLocal('playlist_remote', null, next)).toBe(true);
    expect(
      (await createPlaylistsAdapter().readLocal(new Map())).get(
        'playlist_remote',
      ),
    ).toEqual(next);
    expect(
      usePlaylistsStore
        .getState()
        .playlists.some(p => p.id === 'playlist_remote'),
    ).toBe(true);

    await playlistService.addToPlaylist(
      'playlist_remote',
      '3',
      'me',
      undefined,
      'upload-2',
    );
    const renamed = {
      ...next,
      name: 'Renamed',
      items: JSON.stringify([[2, 'b', '']]),
    };
    expect(await adapter.applyLocal('playlist_remote', next, renamed)).toBe(
      true,
    );
    const after = await playlistService.getPlaylistItems('playlist_remote');
    expect(after.map(item => item.reciterId)).toEqual(['b', 'me']);

    expect(await adapter.applyLocal('playlist_remote', renamed, null)).toBe(
      true,
    );
    expect(await playlistService.getPlaylist('playlist_remote')).toBeNull();
  });

  it('refuses to overwrite a playlist edited since it was read', async () => {
    const playlist = await playlistService.createPlaylist('Mine', '#fff');
    const adapter = createPlaylistsAdapter();
    const before = (await adapter.readLocal(new Map())).get(playlist.id)!;
    await playlistService.updatePlaylist(playlist.id, {name: 'Edited'});
    expect(
      await adapter.applyLocal(playlist.id, before, {
        ...before,
        name: 'Remote',
      }),
    ).toBe(false);
    expect((await playlistService.getPlaylist(playlist.id))?.name).toBe(
      'Edited',
    );
  });

  it('signals user edits from the store', async () => {
    const listener = jest.fn();
    const stop = onLibraryEdited(listener);
    await usePlaylistsStore.getState().createPlaylist('Signalled', '#fff');
    stop();
    expect(listener).toHaveBeenCalled();
  });
});

describe('saved adhkar adapter', () => {
  it('reads and replaces saved adhkar, refusing over a newer edit', async () => {
    await adhkarService.toggleSaved('dhikr-1');
    const adapter = createAdhkarAdapter();
    const local = (await adapter.readLocal(new Map())).get('saved')!;
    expect(Object.keys(local)).toEqual(['dhikr-1']);

    expect(
      await adapter.applyLocal('saved', local, {...local, 'dhikr-2': '7'}),
    ).toBe(true);
    expect((await adhkarService.getSaved()).map(s => s.dhikrId).sort()).toEqual(
      ['dhikr-1', 'dhikr-2'],
    );
    expect(useAdhkarStore.getState().savedIds.has('dhikr-2')).toBe(true);

    await adhkarService.toggleSaved('dhikr-3');
    expect(
      await adapter.applyLocal('saved', {...local, 'dhikr-2': '7'}, {}),
    ).toBe(false);
    expect((await adhkarService.getSaved()).length).toBe(3);
  });
});

afterAll(() => databaseService.close());
