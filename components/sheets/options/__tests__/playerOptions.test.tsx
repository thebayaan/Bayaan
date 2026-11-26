/**
 * Loved in the player's options (the sheet on phones, the native menu on
 * tablets). An upload is loved as itself, by its own id, the way the
 * player's heart and the Uploads screen save it. Asked by reciter, surah and
 * rewayah, a loved upload read as not loved here, and the toggle loved the
 * catalogue recording of that surah instead. The same goes for the Loved row
 * of the "Add to collection" sheet the options open.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {SheetManager, type SheetProps} from 'react-native-actions-sheet';
import {SURAHS, type Surah} from '@/data/surahData';
import type {NativeMenuEntry} from '@/components/native/menuTypes';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {trackFavoriteToggled: jest.fn()},
}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn(), hide: jest.fn()},
}));
jest.mock('@/components/sheets/SheetGestures', () => ({
  SheetScrollView: jest.requireActual('react-native').View,
}));
// What the real "Add to collection" sheet (SelectPlaylistSheet) renders with.
jest.mock('@/components/sheets/AdaptiveActionSheet', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => (
      <MockView>{children}</MockView>
    ),
  };
});
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        textTertiary: '#999999',
        background: '#ffffff',
      },
    },
  }),
}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/components/Icons', () => ({
  HeartIcon: () => null,
  PlaylistIcon: () => null,
}));
jest.mock('@/hooks/usePlaylists', () => ({
  usePlaylists: () => ({
    playlists: [],
    createPlaylist: jest.fn(),
    addToPlaylist: jest.fn(),
  }),
}));
jest.mock('@/components/collection/showCreatePlaylistSheet', () => ({
  showCreatePlaylistSheet: jest.fn(),
}));
jest.mock('@/components/PlaylistItem', () => ({PlaylistItem: () => null}));
jest.mock('@/services/player/store/downloadSelectors', () => ({
  useDownloadActions: () => ({
    setDownloading: jest.fn(),
    addDownload: jest.fn(),
    clearDownloading: jest.fn(),
    setDownloadProgress: jest.fn(),
  }),
  useDownloadProgress: () => 0,
  useIsDownloaded: () => false,
  useIsDownloadedWithRewayat: () => false,
  useIsDownloading: () => false,
}));
jest.mock('@/services/downloadService', () => ({downloadSurah: jest.fn()}));
jest.mock('../downloadFailedToast', () => ({
  showDownloadFailedToast: jest.fn(),
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: () => undefined,
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => ({playback: {position: 0}})},
}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: {getState: () => ({getRecitationById: () => undefined})},
}));
jest.mock('@/utils/shareUtils', () => ({
  recitationShareUrl: jest.fn(),
  shareUrl: jest.fn(),
}));
let mockMenuEntries: NativeMenuEntry[] = [];
jest.mock('../OptionsMenu', () => ({
  OptionsMenuView: ({model}: {model: {entries: NativeMenuEntry[]}}) => {
    mockMenuEntries = model.entries;
    return null;
  },
  useNativeOptionsMenu: () => true,
}));

import {useLovedStore} from '@/services/player/store/lovedStore';
import {HeartIcon} from '@/components/Icons';
import {SelectPlaylistSheet} from '@/components/sheets/SelectPlaylistSheet';
import {
  PlayerOptionsMenu,
  usePlayerOptions,
  type PlayerOptionsPayload,
} from '../playerOptions';

type Options = ReturnType<typeof usePlayerOptions>;

let options!: Options;
let renderer: TestRenderer.ReactTestRenderer | null = null;
let sheet: TestRenderer.ReactTestRenderer | null = null;

function Probe({payload}: {payload: PlayerOptionsPayload}) {
  options = usePlayerOptions(payload, () => undefined);
  return null;
}

/** Opens the options for the playing track, as the ••• button does. */
function open(payload: PlayerOptionsPayload) {
  act(() => {
    renderer = TestRenderer.create(<Probe payload={payload} />);
  });
}

/**
 * Taps "Add to collection" in the open options and renders the sheet it
 * asks for, with what it hands that sheet.
 */
function addToCollection() {
  act(() => options.handleAddToPlaylist());
  const [, shown] = jest.mocked(SheetManager.show).mock.lastCall ?? [];
  act(() => {
    sheet = TestRenderer.create(
      <SelectPlaylistSheet
        sheetId="select-playlist"
        payload={shown?.payload as SheetProps<'select-playlist'>['payload']}
      />,
    );
  });
}

/** The Loved row of that sheet: whether it reads loved, and a tap on it. */
function lovedRow() {
  const heart = sheet!.root.findByType(HeartIcon as never);
  let row = heart.parent;
  while (row && typeof row.props.onPress !== 'function') row = row.parent;
  return {
    isLoved: heart.props.filled as boolean,
    tap: () => act(() => row!.props.onPress()),
  };
}

const surah = SURAHS.find(s => s.id === 36) as Surah;

/**
 * What PlayerBody hands the options for an upload tagged with a reciter and
 * a rewayah the catalogue knows: the track carries that rewayah's id.
 */
const upload: PlayerOptionsPayload = {
  surah,
  reciterId: 'reciter-a',
  rewayatId: 'reciter-a-hafs',
  isUserUpload: true,
  userRecitationId: 'u1',
};
/** The catalogue recording of the same reciter, surah and rewayah. */
const catalogue: PlayerOptionsPayload = {
  surah,
  reciterId: 'reciter-a',
  rewayatId: 'reciter-a-hafs',
};

const loveUploadByItsId = () =>
  useLovedStore.getState().toggleLoved('reciter-a', '36', '', 'u1');
const loveCatalogue = () =>
  useLovedStore.getState().toggleLoved('reciter-a', '36', 'reciter-a-hafs');

const saved = () =>
  useLovedStore
    .getState()
    .tracks.map(({timestamp: _timestamp, ...rest}) => rest);

beforeEach(() => {
  useLovedStore.setState({tracks: []});
  mockMenuEntries = [];
  jest.mocked(SheetManager.show).mockClear();
});

afterEach(() => {
  act(() => {
    sheet?.unmount();
    renderer?.unmount();
  });
  sheet = null;
  renderer = null;
});

describe("the player's options on an upload", () => {
  it('show a loved upload as loved', () => {
    act(loveUploadByItsId);
    open(upload);

    expect(options.isLovedState).toBe(true);
  });

  it('unlove a loved upload and love nothing else', () => {
    act(loveUploadByItsId);
    open(upload);

    act(() => options.handleToggleLove());

    expect(saved()).toEqual([]);
    expect(options.isLovedState).toBe(false);
  });

  it('love the upload itself, not the catalogue recording', () => {
    open(upload);

    act(() => options.handleToggleLove());

    expect(saved()).toEqual([
      {
        reciterId: 'reciter-a',
        surahId: '36',
        rewayatId: '',
        userRecitationId: 'u1',
      },
    ]);
    expect(options.isLovedState).toBe(true);
  });

  it('do not show an upload as loved for its catalogue recording', () => {
    act(loveCatalogue);
    open(upload);

    expect(options.isLovedState).toBe(false);
  });

  it('read the same on the tablet menu', () => {
    act(loveUploadByItsId);
    act(() => {
      renderer = TestRenderer.create(<PlayerOptionsMenu payload={upload} />);
    });

    const love = mockMenuEntries.find(e => e.id === 'love');
    expect(love?.systemImage).toBe('heart.fill');
  });

  // The way the Uploads menus open it. Without a rewayah, so the same upload
  // cannot go into one playlist twice (once from here, once from Uploads).
  it('open "Add to collection" for the upload itself, by its id', () => {
    open(upload);

    act(() => options.handleAddToPlaylist());

    expect(SheetManager.show).toHaveBeenCalledWith('select-playlist', {
      payload: {
        surah,
        reciterId: 'reciter-a',
        rewayatId: undefined,
        userRecitationId: 'u1',
      },
    });
  });

  it('show a loved upload as loved in the Loved row of "Add to collection"', () => {
    act(loveUploadByItsId);
    open(upload);

    addToCollection();

    expect(lovedRow().isLoved).toBe(true);
  });

  it('unlove the upload from that Loved row and love nothing else', () => {
    act(loveUploadByItsId);
    open(upload);
    addToCollection();

    lovedRow().tap();

    expect(saved()).toEqual([]);
    expect(lovedRow().isLoved).toBe(false);
  });
});

describe("the player's options on a catalogue recording", () => {
  it('still love it by reciter, surah and rewayah', () => {
    open(catalogue);

    act(() => options.handleToggleLove());

    expect(saved()).toEqual([
      {
        reciterId: 'reciter-a',
        surahId: '36',
        rewayatId: 'reciter-a-hafs',
        userRecitationId: undefined,
      },
    ]);
    expect(options.isLovedState).toBe(true);
  });

  it('still open "Add to collection" by reciter, surah and rewayah', () => {
    open(catalogue);

    act(() => options.handleAddToPlaylist());

    expect(SheetManager.show).toHaveBeenCalledWith('select-playlist', {
      payload: {surah, reciterId: 'reciter-a', rewayatId: 'reciter-a-hafs'},
    });
  });
});
