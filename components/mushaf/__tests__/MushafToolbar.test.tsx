// @ai-generated
/**
 * The iOS 26 glass toolbar of the mushaf screen (app/mushaf.tsx, which
 * replaces MushafPlayerBar on those devices). Lives outside app/ because every
 * file there is bundled as a route.
 *
 *  - the verse label is in the numbering of the mushaf on screen (the store's
 *    currentVerseLabel), never "S:0", and says when verse tracking is off;
 *  - previous / next ayah are disabled when there is no verse tracking;
 *  - refused playback requests and untracked surahs surface as notices.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

const mockShowToast = jest.fn();

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual('react');
  function Toolbar({children}: {children: unknown}) {
    return ReactActual.createElement('Toolbar', null, children);
  }
  function ToolbarButton(props: {children?: unknown}) {
    return ReactActual.createElement('ToolbarButton', props, props.children);
  }
  function ToolbarSpacer() {
    return null;
  }
  Toolbar.Button = ToolbarButton;
  Toolbar.Spacer = ToolbarSpacer;
  return {Stack: {Toolbar}, useLocalSearchParams: () => ({})};
});

jest.mock('expo-screen-orientation', () => ({
  unlockAsync: jest.fn(),
  lockAsync: jest.fn(),
  OrientationLock: {PORTRAIT_UP: 1},
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {colors: {background: '#fff', text: '#111'}}}),
}));

jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: true}));

jest.mock('@/components/mushaf/main', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    initialized: true,
    rewayah: 'hafs',
    getSurahStartPages: () => ({}),
    switchRewayah: jest.fn(() => Promise.resolve()),
  },
}));

// @ai-start
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {
    state: 'ready',
    subscribe: () => () => undefined,
    initialize: jest.fn(() => Promise.resolve()),
  },
}));
// @ai-end

jest.mock('@/services/mushaf/MushafSessionStore', () => ({
  mushafSessionStore: {setLastScreenWasMushaf: jest.fn()},
}));

jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn()},
}));

jest.mock('@/utils/toastUtils', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

// mushafPlayerStore's playback dependencies (not exercised here)
jest.mock('expo-audio', () => ({createAudioPlayer: jest.fn()}));
jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {mushafWillPlay: jest.fn(), sourceDidStop: jest.fn()},
}));
jest.mock('@/data/reciterData', () => ({RECITERS: []}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: async () => null},
}));
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {getOrderedVerseKeysForPage: () => []},
}));

import {MushafToolbar} from '@/app/mushaf';
import {
  useMushafPlayerStore,
  VERSE_TIMING_UNAVAILABLE_ERROR,
} from '@/store/mushafPlayerStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

interface ButtonProps {
  icon?: string;
  disabled?: boolean;
  children?: unknown;
}

let renderer: TestRenderer.ReactTestRenderer | null = null;

function buttons(): ButtonProps[] {
  return renderer!.root
    .findAll(n => n.type === ('ToolbarButton' as never))
    .map(n => n.props as ButtonProps);
}

const button = (icon: string) => buttons().find(b => b.icon === icon)!;
const playPause = () =>
  buttons().find(b => b.icon === 'pause.fill' || b.icon === 'play.fill')!;

function setPlayer(state: object) {
  act(() => {
    useMushafPlayerStore.setState(state);
  });
}

beforeEach(() => {
  mockShowToast.mockClear();
  useMushafPlayerStore.setState({
    playbackState: 'idle',
    currentSurah: 0,
    currentAyah: 0,
    currentVerseKey: null,
    currentVerseKeys: [],
    currentVerseLabel: null,
    numberingMode: null,
    timestampError: null,
    isImmersive: false,
    isSearchMode: false,
  });
  act(() => {
    renderer = TestRenderer.create(<MushafToolbar />);
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('verse label', () => {
  it('Hafs: "<surah> <surah>:<ayah>" exactly as before', () => {
    setPlayer({
      playbackState: 'playing',
      currentSurah: 2,
      currentAyah: 5,
      currentVerseKey: '2:5',
      currentVerseKeys: ['2:5'],
      currentVerseLabel: '2:5',
      numberingMode: 'hafs',
    });
    expect(playPause().children).toBe('Al-Baqarah 2:5');
    expect(button('backward.end.fill').disabled).toBe(false);
    expect(button('forward.end.fill').disabled).toBe(false);
  });

  it('uses the numbering of the mushaf on screen (Warsh 2:4 = Hafs 2:5)', () => {
    setPlayer({
      playbackState: 'playing',
      currentSurah: 2,
      currentAyah: 5, // Hafs ayah
      currentVerseKey: '2:5',
      currentVerseKeys: ['2:5'],
      currentVerseLabel: '2:4', // what the Warsh mushaf shows
      numberingMode: 'riwayah',
    });
    expect(playPause().children).toBe('Al-Baqarah 2:4');
  });

  it('a reciter verse spanning Hafs verses reads as a range in a Hafs mushaf', () => {
    setPlayer({
      playbackState: 'playing',
      currentSurah: 2,
      currentAyah: 1,
      currentVerseKey: '2:1',
      currentVerseKeys: ['2:1', '2:2'],
      currentVerseLabel: '2:1-2',
      numberingMode: 'riwayah',
    });
    expect(playPause().children).toBe('Al-Baqarah 2:1-2');
  });

  it('no verse tracking: says so (never "67:0") and disables prev / next', () => {
    setPlayer({
      playbackState: 'playing',
      currentSurah: 67,
      currentAyah: 0,
      numberingMode: 'disabled',
    });
    expect(playPause().children).toBe('Al-Mulk · Verse tracking unavailable');
    expect(button('backward.end.fill').disabled).toBe(true);
    expect(button('forward.end.fill').disabled).toBe(true);
  });

  it('before the first verse: the surah alone (never "2:0")', () => {
    setPlayer({
      playbackState: 'loading',
      currentSurah: 2,
      currentAyah: 0,
      numberingMode: 'hafs',
    });
    expect(playPause().children).toBe('Al-Baqarah');
  });
});

describe('notices', () => {
  it('a refused playback request is surfaced', () => {
    setPlayer({timestampError: VERSE_TIMING_UNAVAILABLE_ERROR});
    expect(mockShowToast).toHaveBeenCalledWith(
      'Playback unavailable',
      VERSE_TIMING_UNAVAILABLE_ERROR,
      'error',
    );
  });

  it('a surah without verse tracking is surfaced once', () => {
    setPlayer({
      playbackState: 'loading',
      currentSurah: 67,
      numberingMode: 'disabled',
    });
    setPlayer({playbackState: 'playing'});
    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      'Verse tracking unavailable',
      'Al-Mulk plays without verse highlighting for this reciter.',
      'none',
    );
  });

  it('normal Hafs playback shows nothing', () => {
    setPlayer({
      playbackState: 'loading',
      currentSurah: 2,
      numberingMode: 'hafs',
    });
    setPlayer({
      playbackState: 'playing',
      currentVerseKey: '2:1',
      currentVerseLabel: '2:1',
    });
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});
