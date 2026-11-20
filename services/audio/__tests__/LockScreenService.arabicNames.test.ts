// @ai-generated
/**
 * In Arabic the lock screen and notification show the surah and reciter
 * names the app shows. Tracks are queued with the English names.
 */

const mockMainPlayer = {
  setActiveForLockScreen: jest.fn(),
  updateLockScreenMetadata: jest.fn(),
  clearLockScreenControls: jest.fn(),
};

const mockMushafPlayer = {
  setActiveForLockScreen: jest.fn(),
  updateLockScreenMetadata: jest.fn(),
  clearLockScreenControls: jest.fn(),
};

jest.mock('@/i18n/language', () => ({
  ...jest.requireActual('@/i18n/language'),
  currentLanguage: 'ar',
}));

jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    usePlayerStore: create(() => ({
      queue: {tracks: [], currentIndex: 0},
      playback: {state: 'paused'},
    })),
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
      reciterName: null,
    })),
  };
});

jest.mock('../ExpoAudioService', () => ({
  expoAudioService: {getPlayer: () => mockMainPlayer},
}));

jest.mock('../MushafAudioService', () => ({
  mushafAudioService: {getPlayer: () => mockMushafPlayer},
}));

jest.mock('../AudioCoordinator', () => ({
  audioCoordinator: {getActiveSource: () => 'none'},
}));

jest.mock('expo-asset', () => ({
  Asset: {fromModule: () => ({downloadAsync: () => Promise.resolve()})},
}));

jest.mock('@/utils/reciterImageLookup', () => ({
  getLocalReciterImage: () => undefined,
}));

import {lockScreenService} from '../LockScreenService';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import arNamesById from '@/data/reciterNamesAr.json';
import fallbackReciters from '@/data/reciters-fallback.json';

const setMain = (state: object) =>
  (usePlayerStore as unknown as {setState: (s: object) => void}).setState(
    state,
  );
const setMushaf = (state: object) =>
  (useMushafPlayerStore as unknown as {setState: (s: object) => void}).setState(
    state,
  );

// A bundled reciter that has an Arabic name.
const reciter = (fallbackReciters as {id: string; name: string}[]).find(
  r => (arNamesById as Record<string, string>)[r.id],
);
if (!reciter) throw new Error('no bundled reciter with an Arabic name');
const arabicName = (arNamesById as Record<string, string>)[reciter.id];

beforeEach(async () => {
  setMain({queue: {tracks: [], currentIndex: 0}, playback: {state: 'paused'}});
  setMushaf({playbackState: 'idle', currentSurah: 0, reciterName: null});
  await lockScreenService.startSync();
  jest.clearAllMocks();
});

afterEach(() => {
  lockScreenService.stopSync();
});

describe('lock screen names in Arabic', () => {
  it('shows the Arabic surah and reciter names for a surah track', () => {
    setMain({
      queue: {
        tracks: [
          {
            id: 'a',
            title: 'Al-Baqarah',
            artist: reciter.name,
            reciterId: reciter.id,
            reciterName: reciter.name,
            surahId: '2',
            artwork: 'https://example.com/a.png',
          },
        ],
        currentIndex: 0,
      },
    });

    expect(mockMainPlayer.setActiveForLockScreen.mock.calls[0][1]).toEqual({
      title: 'البقرة',
      artist: arabicName,
      artworkUrl: 'https://example.com/a.png',
    });
  });

  it('keeps an upload’s own title and name', () => {
    setMain({
      queue: {
        tracks: [
          {
            id: 'u',
            title: 'Fajr at the masjid',
            artist: 'My Recitations',
            reciterId: reciter.id,
            reciterName: 'My Recitations',
            surahId: '2',
            isUserUpload: true,
            artwork: 'https://example.com/u.png',
          },
        ],
        currentIndex: 0,
      },
    });

    expect(mockMainPlayer.setActiveForLockScreen.mock.calls[0][1]).toEqual({
      title: 'Fajr at the masjid',
      artist: 'My Recitations',
      artworkUrl: 'https://example.com/u.png',
    });
  });

  it('shows the Arabic names for verse audio in the Mushaf', () => {
    setMushaf({
      playbackState: 'playing',
      currentSurah: 2,
      numberingMode: 'hafs',
      currentVerseKey: '2:5',
      currentVerseLabel: '٢:٥',
      reciterName: reciter.name,
    });

    expect(mockMushafPlayer.setActiveForLockScreen.mock.calls[0][1]).toEqual({
      title: 'البقرة · ٢:٥',
      artist: arabicName,
    });
  });
});
