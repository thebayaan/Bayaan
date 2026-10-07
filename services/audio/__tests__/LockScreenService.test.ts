// @ai-generated
/**
 * Lock screen title during mushaf playback: the verse in the numbering of the
 * mushaf on screen (the player bar's label), and a surah without verse
 * tracking must not keep the previous surah's title.
 */

const mockMushafPlayer = {updateLockScreenMetadata: jest.fn()};

jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    usePlayerStore: create(() => ({queue: {tracks: [], currentIndex: 0}})),
  };
});

jest.mock('@/store/mushafPlayerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useMushafPlayerStore: create(() => ({
      playbackState: 'idle',
      currentSurah: 0,
      currentVerseKey: null,
      currentVerseLabel: null,
      numberingMode: null,
      reciterName: 'Test Reciter',
    })),
  };
});

jest.mock('../ExpoAudioService', () => ({
  expoAudioService: {getPlayer: () => null},
}));

jest.mock('../MushafAudioService', () => ({
  mushafAudioService: {getPlayer: () => mockMushafPlayer},
}));

jest.mock('../AudioCoordinator', () => ({
  audioCoordinator: {},
}));

import {lockScreenService, mushafLockScreenTitle} from '../LockScreenService';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';

const setMushaf = (state: object) =>
  (useMushafPlayerStore as unknown as {setState: (s: object) => void}).setState(
    state,
  );

const titles = () =>
  mockMushafPlayer.updateLockScreenMetadata.mock.calls.map(
    ([metadata]) => (metadata as {title: string}).title,
  );

beforeEach(async () => {
  mockMushafPlayer.updateLockScreenMetadata.mockClear();
  setMushaf({
    playbackState: 'idle',
    currentSurah: 0,
    currentVerseKey: null,
    currentVerseLabel: null,
    numberingMode: null,
  });
  await lockScreenService.startSync();
});

afterEach(() => {
  lockScreenService.stopSync();
});

describe('mushafLockScreenTitle', () => {
  const name = (n: number) => ({2: 'Al-Baqarah', 67: 'Al-Mulk'})[n] ?? null;

  it('Hafs: "<surah> · <verse key>" as before', () => {
    expect(
      mushafLockScreenTitle(
        {
          currentSurah: 2,
          currentVerseKey: '2:5',
          currentVerseLabel: '2:5',
          numberingMode: 'hafs',
        },
        name,
      ),
    ).toBe('Al-Baqarah · 2:5');
  });

  it('uses the label in the numbering of the mushaf on screen', () => {
    // Warsh reciter in a Warsh mushaf: Warsh 2:4 (Hafs 2:5)
    expect(
      mushafLockScreenTitle(
        {
          currentSurah: 2,
          currentVerseKey: '2:5',
          currentVerseLabel: '2:4',
          numberingMode: 'riwayah',
        },
        name,
      ),
    ).toBe('Al-Baqarah · 2:4');
  });

  it('a surah without verse tracking shows its name alone', () => {
    expect(
      mushafLockScreenTitle(
        {
          currentSurah: 67,
          currentVerseKey: null,
          currentVerseLabel: null,
          numberingMode: 'disabled',
        },
        name,
      ),
    ).toBe('Al-Mulk');
  });

  it('waits for the first verse of a tracked surah', () => {
    expect(
      mushafLockScreenTitle(
        {
          currentSurah: 2,
          currentVerseKey: null,
          currentVerseLabel: null,
          numberingMode: 'hafs',
        },
        name,
      ),
    ).toBeNull();
  });
});

describe('lock screen sync', () => {
  it('Hafs: one update per verse, same titles as before', () => {
    setMushaf({
      playbackState: 'loading',
      currentSurah: 2,
      numberingMode: 'hafs',
    });
    for (const ayah of [5, 6, 7]) {
      setMushaf({
        playbackState: 'playing',
        currentVerseKey: `2:${ayah}`,
        currentVerseLabel: `2:${ayah}`,
      });
    }
    setMushaf({playbackState: 'playing'}); // unrelated update
    expect(titles()).toEqual([
      'Al-Baqarah · 2:5',
      'Al-Baqarah · 2:6',
      'Al-Baqarah · 2:7',
    ]);
  });

  it('entering a surah without verse tracking replaces the previous title', () => {
    setMushaf({
      playbackState: 'playing',
      currentSurah: 66,
      numberingMode: 'riwayah',
      currentVerseKey: '66:12',
      currentVerseLabel: '66:12',
    });
    // advance into al-Mulk (al-Duri set 269: no verse numbering)
    setMushaf({
      playbackState: 'loading',
      currentSurah: 67,
      numberingMode: 'disabled',
      currentVerseKey: null,
      currentVerseLabel: null,
    });
    setMushaf({playbackState: 'playing'});
    expect(titles()).toEqual(['At-Tahrim · 66:12', 'Al-Mulk']);
  });
});
