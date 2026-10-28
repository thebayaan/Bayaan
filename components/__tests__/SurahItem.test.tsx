// @ai-start
import React from 'react';
import {act, create, ReactTestRenderer} from 'react-test-renderer';
import type {StoreApi} from 'zustand';
import type {Surah} from '@/data/surahData';
import type {Track} from '@/types/audio';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {SurahItem} from '../SurahItem';

// Each SurahItem render calls useIsDownloading(downloadId) once, so this
// counter records the renders of each row. The name starts with `mock` so
// the jest.mock factories below can read it.
const mockRenderCounts: Record<string, number> = {};

// The props of each NowPlayingIndicator render, newest last. SurahItem
// renders the indicator only when the row has onOptionsPress.
const mockIndicatorProps: Array<{isPlaying: boolean}> = [];

type MockPlayerState = {
  playback: {state: string};
  queue: {tracks: Track[]; currentIndex: number};
};

jest.mock('@/services/player/store/playerStore', () => {
  const {create: createMockStore} = jest.requireActual('zustand');
  return {
    usePlayerStore: createMockStore(() => ({
      playback: {state: 'none'},
      queue: {tracks: [], currentIndex: -1},
    })),
  };
});

jest.mock('@/services/player/store/downloadSelectors', () => ({
  useIsDownloaded: () => false,
  useIsDownloadedWithRewayat: () => false,
  useIsDownloading: (downloadId: string) => {
    mockRenderCounts[downloadId] = (mockRenderCounts[downloadId] ?? 0) + 1;
    return false;
  },
  useDownloadProgress: () => 0,
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#000000',
        textSecondary: '#666666',
        background: '#ffffff',
        card: '#eeeeee',
      },
      fonts: {regular: 'Regular'},
    },
  }),
}));

jest.mock('react-native-size-matters', () => ({
  ScaledSheet: {create: (styles: object) => styles},
  moderateScale: (value: number) => value,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {Light: 'light', Medium: 'medium'},
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  Ionicons: () => null,
}));

jest.mock('@/components/Icons', () => ({
  HeartIcon: () => null,
  MakkahIcon: () => null,
  MadinahIcon: () => null,
}));

jest.mock('@/components/CircularProgress', () => ({
  CircularProgress: () => null,
}));

jest.mock('@/components/GradientText', () => ({
  GradientText: () => null,
}));

jest.mock('../NowPlayingIndicator', () => ({
  NowPlayingIndicator: (props: {isPlaying: boolean}) => {
    mockIndicatorProps.push(props);
    return null;
  },
}));

// jest hoists the jest.mock calls above the imports, so SurahItem and
// usePlayerStore resolve to the mocks.
const playerStore = usePlayerStore as unknown as StoreApi<MockPlayerState>;

const surah = (id: number): Surah => ({
  id,
  name: `Surah ${id}`,
  revelation_place: 'makkah',
  revelation_order: id,
  bismillah_pre: true,
  name_arabic: '',
  verses_count: 7,
  pages: '1',
  translated_name_english: `Translation ${id}`,
});

const track = (surahId: number, rewayatId = 'rw-a'): Track => ({
  id: `reciter-1:${surahId}:${rewayatId}`,
  url: 'https://example.invalid/audio.mp3',
  title: `Surah ${surahId}`,
  artist: 'Reciter 1',
  reciterId: 'reciter-1',
  reciterName: 'Reciter 1',
  surahId: String(surahId),
  rewayatId,
});

const noop = jest.fn();

// The key of mockRenderCounts is the downloadId of the row. SurahItem.tsx
// builds it as `${reciterId}-${item.id}-${rewayatId}` in its downloadId
// useMemo. Change this helper if that format changes.
const rowKey = (surahId: number): string => `reciter-1-${surahId}-rw-a`;

const playLabelOf = (renderer: ReactTestRenderer, surahId: number): string =>
  renderer.root
    .findAll(
      node =>
        node.props?.accessibilityHint === 'Tap to play Surah' &&
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith(`Surah Surah ${surahId},`),
    )
    .map(node => node.props.accessibilityLabel as string)[0];

const resetCounts = () => {
  Object.keys(mockRenderCounts).forEach(key => delete mockRenderCounts[key]);
};

describe('SurahItem player-store subscriptions', () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    playerStore.setState({
      playback: {state: 'none'},
      queue: {tracks: [], currentIndex: -1},
    });
    const rows = (onOptionsPress: () => void) => (
      <>
        {[1, 2, 3, 4, 5].map(id => (
          <SurahItem
            key={id}
            item={surah(id)}
            onPress={noop}
            onOptionsPress={onOptionsPress}
            reciterId="reciter-1"
            rewayatId="rw-a"
          />
        ))}
      </>
    );
    act(() => {
      renderer = create(rows(noop));
    });
    // useTranslation sets its state to the same value in a mount effect.
    // React keeps that update queued at a lower priority, so the first
    // store-driven re-render of a row runs once more to apply it. One
    // re-render of every row (a new onOptionsPress) applies it first, so the
    // counts below hold only the renders that player-store changes cause.
    act(() => {
      renderer.update(rows(jest.fn()));
    });
    resetCounts();
    mockIndicatorProps.length = 0;
  });

  afterEach(() => {
    act(() => renderer.unmount());
  });

  it('re-renders only the row that starts to play', () => {
    act(() => {
      playerStore.setState({
        playback: {state: 'playing'},
        queue: {tracks: [track(1), track(2), track(3)], currentIndex: 0},
      });
    });

    expect(mockRenderCounts).toEqual({[rowKey(1)]: 1});
  });

  it('does not re-render any row when the queue gets a new tracks array with the same current track', () => {
    act(() => {
      playerStore.setState({
        playback: {state: 'playing'},
        queue: {tracks: [track(1), track(2)], currentIndex: 0},
      });
    });
    resetCounts();

    act(() => {
      playerStore.setState({
        queue: {tracks: [track(1), track(2), track(3)], currentIndex: 0},
      });
    });

    expect(mockRenderCounts).toEqual({});
  });

  it('re-renders only the previous row and the new row when the track changes', () => {
    act(() => {
      playerStore.setState({
        playback: {state: 'playing'},
        queue: {tracks: [track(1), track(2), track(3)], currentIndex: 0},
      });
    });
    resetCounts();

    act(() => {
      playerStore.setState({
        queue: {tracks: [track(1), track(2), track(3)], currentIndex: 1},
      });
    });

    expect(mockRenderCounts).toEqual({
      [rowKey(1)]: 1,
      [rowKey(2)]: 1,
    });
  });

  it('re-renders only the current row on pause and stops its indicator', () => {
    act(() => {
      playerStore.setState({
        playback: {state: 'playing'},
        queue: {tracks: [track(1), track(2), track(3)], currentIndex: 0},
      });
    });
    expect(playLabelOf(renderer, 1)).toContain('currently playing');
    expect(mockIndicatorProps[mockIndicatorProps.length - 1]?.isPlaying).toBe(
      true,
    );
    resetCounts();

    act(() => {
      playerStore.setState({playback: {state: 'paused'}});
    });

    expect(mockRenderCounts).toEqual({[rowKey(1)]: 1});
    expect(playLabelOf(renderer, 1)).not.toContain('currently playing');
    expect(mockIndicatorProps[mockIndicatorProps.length - 1]?.isPlaying).toBe(
      false,
    );
  });
});

describe('SurahItem currently-playing label', () => {
  const playLabelFor = (rewayatId: string): string => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <SurahItem
          item={surah(1)}
          onPress={noop}
          reciterId="reciter-1"
          rewayatId={rewayatId}
        />,
      );
    });
    const labels = renderer.root
      .findAll(node => node.props.accessibilityHint === 'Tap to play Surah')
      .map(node => node.props.accessibilityLabel as string);
    act(() => renderer.unmount());
    return labels[0];
  };

  it('announces "currently playing" only for the rewayah that plays', () => {
    playerStore.setState({
      playback: {state: 'playing'},
      queue: {tracks: [track(1, 'rw-a')], currentIndex: 0},
    });

    expect(playLabelFor('rw-a')).toContain('currently playing');
    expect(playLabelFor('rw-b')).not.toContain('currently playing');
  });
});
// @ai-end
