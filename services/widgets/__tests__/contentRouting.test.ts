// services/widgets/__tests__/contentRouting.test.ts
import type {Reciter} from '@/data/reciterData';
import type {WidgetCommand} from 'bayaan-widgets';
import {
  CommandDeps,
  handleWidgetCommand,
  setContentCommandRunner,
} from '../handleWidgetCommand';

const mockRun = jest.fn<
  Promise<void>,
  [WidgetCommand, (r: Reciter, s: number) => Promise<boolean>]
>();

jest.mock('@/utils/track', () => ({
  createTrack: jest.fn(async (_r: unknown, surah: {id: number}) => ({
    id: `x-${surah.id}`,
    surahId: String(surah.id),
    rewayatId: 'rw1',
  })),
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: () => undefined,
  getSurahById: jest.fn((id: number) => (id === 999 ? undefined : {id})),
}));
jest.mock('@/store/reciterStore', () => ({useReciterStore: {}}));
jest.mock('@/services/player/store/playerStore', () => ({usePlayerStore: {}}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {},
}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {},
}));
jest.mock('@/services/audio/ExpoAudioService', () => ({expoAudioService: {}}));
jest.mock('@/services/player/utils/resumeRecent', () => ({
  resumeRecent: jest.fn(),
}));
jest.mock('@/services/player/utils/restoreSession', () => ({
  pendingRestoreLoad: jest.fn(),
}));

setContentCommandRunner((c, play) => mockRun(c, play));

const reciter = {
  id: 'r1',
  name: 'R',
  rewayat: [{id: 'rw1', surah_list: [67], surah_total: 1}],
} as unknown as Reciter;

function fakeDeps(): CommandDeps {
  return {
    playTracks: jest.fn(async () => undefined),
    startNewChain: jest.fn(),
    ayahStartSec: jest.fn(async () => 12),
  } as unknown as CommandDeps;
}

it('routes playPlaylist and startBedtime to contentCommands', async () => {
  const deps = fakeDeps();
  const playlist: WidgetCommand = {
    type: 'playPlaylist',
    playlistId: 'p',
    itemId: null,
  };
  const bedtime: WidgetCommand = {
    type: 'startBedtime',
    surahId: 67,
    reciterId: null,
    sleepMinutes: 30,
    ambient: null,
  };
  await handleWidgetCommand(playlist, deps);
  await handleWidgetCommand(bedtime, deps);
  expect(mockRun.mock.calls.map(c => c[0])).toEqual([playlist, bedtime]);
});

it('passes a play-from-start function that starts at 0 and reports success', async () => {
  const deps = fakeDeps();
  await handleWidgetCommand(
    {
      type: 'startBedtime',
      surahId: 67,
      reciterId: null,
      sleepMinutes: 30,
      ambient: null,
    },
    deps,
  );
  const play = mockRun.mock.calls[mockRun.mock.calls.length - 1][1];
  await expect(play(reciter, 67)).resolves.toBe(true);
  expect(deps.playTracks).toHaveBeenCalledWith(
    [expect.objectContaining({surahId: '67'})],
    0,
  );
  expect(deps.startNewChain).toHaveBeenCalledWith(reciter, 67, 'rw1');
  await expect(play(reciter, 999)).resolves.toBe(false);
  expect(deps.startNewChain).toHaveBeenCalledTimes(1);
});
