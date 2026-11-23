// @ai-generated
/**
 * A Continue Listening card whose surah is already in the player plays and
 * pauses it. It used to resume it again, which reloaded the stream and
 * replaced the queue it was playing from.
 */
import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';

const mockUpdateQueue = jest.fn(async () => undefined);
const mockPlay = jest.fn(async () => undefined);
const mockPause = jest.fn(async () => undefined);
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({
    updateQueue: mockUpdateQueue,
    play: mockPlay,
    pause: mockPause,
  }),
}));
const mockResumeRecent = jest.fn(async (_args: unknown) => undefined);
jest.mock('@/services/player/utils/resumeRecent', () => ({
  resumeRecent: (args: unknown) => mockResumeRecent(args),
}));
const mockResumeChain = jest.fn();
// The recents list as the store holds it. The second entry is a broken one
// that Home leaves out, so the card under test is the second card on Home
// and the third entry in the list.
const mockRecents = {tracks: [] as object[]};
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {
    getState: () => ({
      resumeChain: mockResumeChain,
      recentTracks: mockRecents.tracks,
    }),
  },
}));
let mockPlayer = {
  queue: {currentIndex: -1, tracks: [] as unknown[]},
  playback: {position: 0, duration: 0, state: 'paused'},
};
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (select: (state: unknown) => unknown) => select(mockPlayer),
}));
const mockUploads = {recitations: [] as {id: string}[]};
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: {getState: () => mockUploads},
}));
jest.mock('@/utils/track', () => ({
  createUserUploadTrack: (recitation: {id: string}) => ({
    id: `upload:${recitation.id}`,
  }),
}));
const mockImage: {names: string[]} = {names: []};
jest.mock('@/components/ReciterImage', () => ({
  ReciterImage: ({reciterName}: {reciterName: string}) => {
    mockImage.names.push(reciterName);
    return null;
  },
}));
const mockSheet = {show: jest.fn()};
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: (...args: unknown[]) => mockSheet.show(...args)},
}));
jest.mock('@/components/sheets/options/OptionsMenu', () => ({
  useNativeOptionsMenu: () => false,
}));
jest.mock('@/components/sheets/options/homeCardOptions', () => ({
  HomeCardOptionsMenu: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('@/components/NowPlayingIndicator', () => ({
  NowPlayingIndicator: () => null,
}));
jest.mock('@/components/ProgressTrack', () => ({ProgressTrack: () => null}));
jest.mock('@/components/Icons', () => ({PlayIcon: () => null}));
jest.mock('@/hooks/useGlassProps', () => ({
  USE_GLASS: false,
  useGlassColorScheme: () => 'light',
}));
jest.mock('expo-glass-effect', () => ({GlassView: 'GlassView'}));
jest.mock('expo-linear-gradient', () => ({LinearGradient: () => null}));
jest.mock('expo-router', () => {
  const Link = ({children}: {children: React.ReactNode}) => children;
  Link.AppleZoom = ({children}: {children: React.ReactNode}) => children;
  return {Link, useRouter: () => ({push: jest.fn()})};
});
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#000000', textSecondary: '#666666', card: '#ffffff'},
    },
  }),
}));

import {RecentReciterCard} from '../RecentReciterCard';

type CardProps = React.ComponentProps<typeof RecentReciterCard>;

function render(props: Partial<CardProps> = {}) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <RecentReciterCard
        reciterName="Reciter"
        surahName="Ya-Sin"
        trackId="r1:36"
        reciterId="r1"
        surahId={36}
        rewayatId="hafs"
        progress={0.5}
        duration={120}
        {...props}
      />,
    );
  });
  return renderer;
}

/** The bottom zone of the card: the one that resumes. */
async function tap(renderer: ReactTestRenderer) {
  const zones = renderer.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      typeof node.props.onPress === 'function' &&
      typeof node.props.onLongPress === 'function',
  );
  await act(async () => {
    zones[zones.length - 1].props.onPress();
  });
}

/** "Continue playing" in the long-press options. */
async function continueFromMenu(renderer: ReactTestRenderer) {
  const zones = renderer.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      typeof node.props.onLongPress === 'function',
  );
  act(() => {
    zones[zones.length - 1].props.onLongPress();
  });
  const {payload} = mockSheet.show.mock.calls[0][1];
  await act(async () => {
    payload.onContinuePlaying();
  });
}

const inPlayer = (state: string, track: object = {}) => ({
  queue: {
    currentIndex: 0,
    tracks: [{reciterId: 'r1', surahId: '36', rewayatId: 'hafs', ...track}],
  },
  playback: {position: 30, duration: 120, state},
});

beforeEach(() => {
  jest.clearAllMocks();
  mockImage.names = [];
  mockUploads.recitations = [];
  mockRecents.tracks = [
    {reciter: {id: 'r0'}, surah: {id: 1}, rewayatId: 'hafs'},
    {reciter: {id: 'gone'}, rewayatId: 'hafs'},
    {reciter: {id: 'r1'}, surah: {id: 36}, rewayatId: 'hafs'},
    {
      reciter: {id: '__uploads__'},
      surah: {id: 0},
      rewayatId: '',
      isUserUpload: true,
      userRecitationId: 'u1',
    },
  ];
  mockPlayer = {
    queue: {currentIndex: -1, tracks: []},
    playback: {position: 0, duration: 0, state: 'paused'},
  };
});

it('resumes a surah that is not in the player where it was left', async () => {
  await tap(render());

  expect(mockResumeRecent).toHaveBeenCalledWith(
    expect.objectContaining({
      reciterId: 'r1',
      surahId: 36,
      rewayatId: 'hafs',
      startPosition: 60,
      // Its place in the store's list, not among the cards on Home (1).
      recentIndex: 2,
    }),
  );
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockPause).not.toHaveBeenCalled();
});

it('pauses the surah that is already playing instead of reloading it', async () => {
  mockPlayer = inPlayer('playing');
  await tap(render());

  expect(mockPause).toHaveBeenCalledTimes(1);
  expect(mockResumeRecent).not.toHaveBeenCalled();
  expect(mockUpdateQueue).not.toHaveBeenCalled();
});

it('plays the surah that is already loaded and paused', async () => {
  mockPlayer = inPlayer('paused');
  await tap(render());

  expect(mockPlay).toHaveBeenCalledTimes(1);
  expect(mockResumeRecent).not.toHaveBeenCalled();
  expect(mockUpdateQueue).not.toHaveBeenCalled();
});

it('still resumes when the player holds another rewayah of the surah', async () => {
  mockPlayer = inPlayer('playing', {rewayatId: 'warsh'});
  await tap(render());

  expect(mockResumeRecent).toHaveBeenCalledTimes(1);
  expect(mockPause).not.toHaveBeenCalled();
});

it('"Continue playing" never pauses what is playing', async () => {
  mockPlayer = inPlayer('playing');
  await continueFromMenu(render());

  expect(mockPause).not.toHaveBeenCalled();
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockResumeRecent).not.toHaveBeenCalled();
});

it('toggles an upload that is already in the player', async () => {
  mockUploads.recitations = [{id: 'u1'}];
  mockPlayer = {
    queue: {currentIndex: 0, tracks: [{userRecitationId: 'u1'}]},
    playback: {position: 10, duration: 60, state: 'playing'},
  };
  await tap(render({isUserUpload: true, userRecitationId: 'u1'}));

  expect(mockPause).toHaveBeenCalledTimes(1);
  expect(mockUpdateQueue).not.toHaveBeenCalled();
});

it('loads an upload that is not in the player', async () => {
  mockUploads.recitations = [{id: 'u1'}];
  await tap(render({isUserUpload: true, userRecitationId: 'u1'}));

  expect(mockUpdateQueue).toHaveBeenCalledWith([{id: 'upload:u1'}], 0, 60);
  expect(mockResumeChain).toHaveBeenCalledWith(3);
});

it('tells the options which upload the card is, and no position', () => {
  const renderer = render({isUserUpload: true, userRecitationId: 'u1'});
  const zones = renderer.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      typeof node.props.onLongPress === 'function',
  );
  act(() => {
    zones[zones.length - 1].props.onLongPress();
  });

  const {payload} = mockSheet.show.mock.calls[0][1];
  expect(payload.userRecitationId).toBe('u1');
  expect(payload).not.toHaveProperty('recentIndex');
});

// The bundled photos are keyed by the catalogue (Latin) name; keyed by the
// Arabic name the card shows, the photo was lost.
it('looks the photo up by the catalogue name while showing the localised one', () => {
  const renderer = render({
    reciterName: 'مشاري العفاسي',
    imageName: 'Mishari Alafasi',
  });

  expect(mockImage.names).toEqual(['Mishari Alafasi']);
  expect(JSON.stringify(renderer.toJSON())).toContain('مشاري العفاسي');
});

it('uses the shown name for the photo when no other is given', () => {
  render();
  expect(mockImage.names).toEqual(['Reciter']);
});
