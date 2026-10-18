// services/widgets/__tests__/contentCommands.test.ts
import type {Reciter} from '@/data/reciterData';
import type {PlaylistItem} from '@/services/database/DatabaseService';
import type {Track} from '@/types/audio';
import {
  ContentCommandDeps,
  playPlaylist,
  rotateToItem,
  runContentCommand,
  startBedtime,
} from '../contentCommands';

jest.mock('@/services/playlist/PlaylistService', () => ({playlistService: {}}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: {getState: () => ({recitations: []})},
}));
jest.mock('@/utils/track', () => ({
  createTrack: jest.fn(),
  createUserUploadTrack: jest.fn(),
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: jest.fn(),
  getSurahById: jest.fn(),
}));
jest.mock('@/services/player/store/playerStore', () => ({usePlayerStore: {}}));
jest.mock('@/store/reciterStore', () => ({useReciterStore: {}}));
jest.mock('@/store/ambientStore', () => ({useAmbientStore: {}}));

const alafasi = {id: 'r1', name: 'Alafasi', rewayat: []} as unknown as Reciter;
const minshawi = {
  id: 'r2',
  name: 'Minshawi',
  rewayat: [],
} as unknown as Reciter;

function track(id: string): Track {
  return {
    id,
    url: '',
    title: id,
    artist: '',
    reciterId: 'r1',
    reciterName: 'R',
    surahId: id,
  } as Track;
}

function item(
  id: string,
  orderIndex: number,
  extra: Partial<PlaylistItem> = {},
): PlaylistItem {
  return {
    id,
    playlistId: 'p',
    surahId: '1',
    reciterId: 'r1',
    orderIndex,
    addedAt: 0,
    ...extra,
  };
}

function deps(
  overrides: Partial<ContentCommandDeps> = {},
): ContentCommandDeps & {log: string[]} {
  const log: string[] = [];
  return {
    log,
    playlistItems: jest.fn(async () => []),
    trackForItem: jest.fn(async (i: PlaylistItem) => track(i.id)),
    playTracks: jest.fn(async (tracks: Track[]) => {
      log.push(`play:${tracks.map(t => t.id).join(',')}`);
    }),
    getReciter: jest.fn((id: string) => (id === 'r2' ? minshawi : undefined)),
    getDefaultReciter: jest.fn(() => alafasi),
    playSurahFromStart: jest.fn(async (r: Reciter, s: number) => {
      log.push(`surah:${r.id}:${s}`);
      return true;
    }),
    setSleepTimer: jest.fn((m: number) => {
      log.push(`timer:${m}`);
    }),
    startAmbient: jest.fn((sound: string) => {
      log.push(`ambient:${sound}`);
    }),
    ...overrides,
  };
}

describe('rotateToItem', () => {
  const entries = [
    {itemId: 'a', value: 1},
    {itemId: 'b', value: 2},
    {itemId: 'c', value: 3},
  ];
  it('starts at the item and wraps around', () => {
    expect(rotateToItem(entries, 'b')).toEqual([2, 3, 1]);
  });
  it('starts at the first item for a missing or null id', () => {
    expect(rotateToItem(entries, 'gone')).toEqual([1, 2, 3]);
    expect(rotateToItem(entries, null)).toEqual([1, 2, 3]);
  });
});

describe('playPlaylist', () => {
  it('queues the playlist in order starting at the tapped item', async () => {
    const d = deps({
      playlistItems: jest.fn(async () => [
        item('c', 2),
        item('a', 0),
        item('b', 1),
      ]),
    });
    await playPlaylist({type: 'playPlaylist', playlistId: 'p', itemId: 'b'}, d);
    expect(d.log).toEqual(['play:b,c,a']);
  });

  it('skips items that cannot be played and still starts at the first playable one', async () => {
    const d = deps({
      playlistItems: jest.fn(async () => [
        item('a', 0),
        item('b', 1),
        item('c', 2),
      ]),
      trackForItem: jest.fn(async (i: PlaylistItem) =>
        i.id === 'b' ? null : track(i.id),
      ),
    });
    await playPlaylist({type: 'playPlaylist', playlistId: 'p', itemId: 'b'}, d);
    expect(d.log).toEqual(['play:a,c']);
  });

  it('plays uploads through trackForItem', async () => {
    const d = deps({
      playlistItems: jest.fn(async () => [
        item('u', 0, {userRecitationId: 'up1'}),
      ]),
    });
    await playPlaylist(
      {type: 'playPlaylist', playlistId: 'p', itemId: null},
      d,
    );
    expect(d.trackForItem).toHaveBeenCalledWith(
      expect.objectContaining({userRecitationId: 'up1'}),
    );
    expect(d.log).toEqual(['play:u']);
  });

  it('does nothing for an empty or missing playlist', async () => {
    const d = deps();
    await playPlaylist(
      {type: 'playPlaylist', playlistId: 'gone', itemId: null},
      d,
    );
    expect(d.playTracks).not.toHaveBeenCalled();
  });
});

describe('startBedtime', () => {
  it('plays from the start, then sets the timer, then starts ambient', async () => {
    const d = deps();
    await startBedtime(
      {
        type: 'startBedtime',
        surahId: 67,
        reciterId: 'r2',
        sleepMinutes: 30,
        ambient: 'rain',
      },
      d,
    );
    expect(d.log).toEqual(['surah:r2:67', 'timer:30', 'ambient:rain']);
  });

  it('uses the default reciter when none is set or the set one is gone', async () => {
    const d = deps();
    await startBedtime(
      {
        type: 'startBedtime',
        surahId: 67,
        reciterId: null,
        sleepMinutes: 15,
        ambient: null,
      },
      d,
    );
    await startBedtime(
      {
        type: 'startBedtime',
        surahId: 67,
        reciterId: 'gone',
        sleepMinutes: 15,
        ambient: null,
      },
      d,
    );
    expect(d.log).toEqual([
      'surah:r1:67',
      'timer:15',
      'surah:r1:67',
      'timer:15',
    ]);
    expect(d.startAmbient).not.toHaveBeenCalled();
  });

  it('leaves the timer and ambient alone when the surah cannot start', async () => {
    const noReciter = deps({getDefaultReciter: jest.fn(() => null)});
    await startBedtime(
      {
        type: 'startBedtime',
        surahId: 67,
        reciterId: null,
        sleepMinutes: 30,
        ambient: 'rain',
      },
      noReciter,
    );
    expect(noReciter.log).toEqual([]);
    const failed = deps({playSurahFromStart: jest.fn(async () => false)});
    await startBedtime(
      {
        type: 'startBedtime',
        surahId: 67,
        reciterId: null,
        sleepMinutes: 30,
        ambient: 'rain',
      },
      failed,
    );
    expect(failed.setSleepTimer).not.toHaveBeenCalled();
    expect(failed.startAmbient).not.toHaveBeenCalled();
  });
});

describe('runContentCommand', () => {
  it('dispatches by type', async () => {
    const d = deps({playlistItems: jest.fn(async () => [item('a', 0)])});
    await runContentCommand(
      {type: 'playPlaylist', playlistId: 'p', itemId: null},
      jest.fn(),
      d,
    );
    await runContentCommand(
      {
        type: 'startBedtime',
        surahId: 36,
        reciterId: null,
        sleepMinutes: 45,
        ambient: null,
      },
      jest.fn(),
      d,
    );
    expect(d.log).toEqual(['play:a', 'surah:r1:36', 'timer:45']);
  });
});
