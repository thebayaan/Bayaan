// @ai-generated
// Which row of a Loved / Downloads / playlist list is shown as playing (the
// gradient title and the animated bars).
import React from 'react';
import {act, create, ReactTestRenderer} from 'react-test-renderer';
import type {StoreApi} from 'zustand';
import type {Track} from '@/types/audio';

type MockPlayerState = {
  playback: {state: string};
  queue: {tracks: Partial<Track>[]; currentIndex: number};
};

jest.mock('@/services/player/store/playerStore', () => {
  const {create: createMockStore} = jest.requireActual('zustand');
  return {
    usePlayerStore: createMockStore(() => ({
      playback: {state: 'playing'},
      queue: {tracks: [], currentIndex: 0},
    })),
  };
});
jest.mock('@/services/player/store/downloadSelectors', () => ({
  useIsDownloadedForPlayback: () => false,
  useIsDownloading: () => false,
  useDownloadProgress: () => 0,
}));
// The reciter has two rewayat; a recording saved without one is the first.
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: (id: string) =>
    id === 'reciter-1'
      ? {
          id,
          name: 'Reciter 1',
          rewayat: [
            {id: 'rw-first', name: "Hafs A'n Assem", style: 'murattal'},
            {id: 'rw-second', name: "Warsh A'n Nafi'", style: 'murattal'},
          ],
        }
      : undefined,
  getSurahById: (id: number) => ({id, name: `Surah ${id}`}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#000000', textSecondary: '#666666', card: '#eee'}},
  }),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false, width: 390}),
}));
jest.mock('@/components/sheets/options/SurahOptionsContext', () => ({
  useSurahOptionsContext: () => null,
}));
jest.mock('@/components/sheets/options/OptionsMenu', () => ({
  useNativeOptionsMenu: () => false,
}));
jest.mock('@/i18n/format', () => ({
  getReciterDisplayName: (reciter: {name: string}) => reciter.name,
  getSurahDisplayName: (surah: {name: string}) => surah.name,
  localizeDigits: (value: number | string) => String(value),
}));
jest.mock('@/components/ReciterImage', () => ({ReciterImage: () => null}));
jest.mock('@/components/CircularProgress', () => ({
  CircularProgress: () => null,
}));
jest.mock('@/components/GradientText', () => ({GradientText: () => null}));
jest.mock('@/components/NowPlayingIndicator', () => ({
  NowPlayingIndicator: () => null,
}));
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  Ionicons: () => null,
}));

import {usePlayerStore} from '@/services/player/store/playerStore';
import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {TrackItem} from '../TrackItem';

const playerStore = usePlayerStore as unknown as StoreApi<MockPlayerState>;

function play(track: Partial<Track>): void {
  act(() => {
    playerStore.setState({
      playback: {state: 'playing'},
      queue: {tracks: [track], currentIndex: 0},
    });
  });
}

interface Row {
  reciterId?: string;
  surahId?: string;
  rewayatId?: string;
  userRecitationId?: string;
}

let renderer: ReactTestRenderer | undefined;

/** Whether a row with these props is shown as the playing track. */
function showsAsPlaying(row: Row): boolean {
  act(() => {
    renderer?.unmount();
    renderer = create(
      <TrackItem
        reciterId={row.reciterId ?? 'reciter-1'}
        surahId={row.surahId ?? '2'}
        rewayatId={row.rewayatId}
        userRecitationId={row.userRecitationId}
        onPress={jest.fn()}
        onOptionsPress={jest.fn()}
      />,
    );
  });
  const bars = renderer?.root.findAll(
    n => (n.type as unknown) === NowPlayingIndicator,
  );
  return (bars?.length ?? 0) > 0;
}

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
});

// What createTrack() queues: the rewayah asked for, or the reciter's first.
const playing = (rewayatId: string): Partial<Track> => ({
  id: 'reciter-1-2',
  reciterId: 'reciter-1',
  surahId: '2',
  rewayatId,
});

describe('TrackItem now-playing highlight', () => {
  it('lights the row of the rewayah that is playing, and only that one', () => {
    play(playing('rw-second'));
    expect(showsAsPlaying({rewayatId: 'rw-second'})).toBe(true);
    expect(showsAsPlaying({rewayatId: 'rw-first'})).toBe(false);
    expect(showsAsPlaying({rewayatId: 'rw-second', surahId: '3'})).toBe(false);
  });

  // Older Loved and Downloads entries carry no rewayah. They play the
  // reciter's first one, and the playing track always names its rewayah, so
  // the row never lit up.
  it('lights a row saved without a rewayah while it plays', () => {
    play(playing('rw-first'));
    expect(showsAsPlaying({rewayatId: undefined})).toBe(true);
    expect(showsAsPlaying({rewayatId: ''})).toBe(true);
  });

  it('keeps such a row dark while another rewayah of the surah plays', () => {
    play(playing('rw-second'));
    expect(showsAsPlaying({rewayatId: undefined})).toBe(false);
  });

  it('still matches a row and a track that both have no rewayah', () => {
    play({id: 'reciter-1-2', reciterId: 'reciter-1', surahId: '2'});
    expect(showsAsPlaying({rewayatId: undefined})).toBe(true);
    expect(showsAsPlaying({rewayatId: 'rw-first'})).toBe(false);
  });

  it('matches an upload by its own id only', () => {
    play({
      id: 'upload-u1',
      reciterId: 'reciter-1',
      surahId: '2',
      userRecitationId: 'u1',
      isUserUpload: true,
    });
    expect(showsAsPlaying({userRecitationId: 'u1'})).toBe(true);
    expect(showsAsPlaying({userRecitationId: 'u2'})).toBe(false);

    // The reciter's own recording of that surah is playing, not the upload.
    play(playing('rw-first'));
    expect(showsAsPlaying({userRecitationId: 'u1'})).toBe(false);
  });
});
