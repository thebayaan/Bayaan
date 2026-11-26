// @ai-generated
/**
 * What the mushaf play options sheet leaves in the player store when it
 * closes (components/sheets/MushafPlayerOptionsSheet.tsx): the real sheet
 * over the real store.
 *
 *  - closed without Play: the start verse it was opened for is forgotten
 *    (it used to become the start of the next Play on any page), and so is
 *    a range no playback is using;
 *  - closed by Play: the range Play applied stays.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {SheetProps} from 'react-native-actions-sheet';

// Strings come from the app's English resources (test-utils/setupI18n.ts).

interface MockSheetProps {
  children: React.ReactNode;
  onBeforeClose?: () => void;
}
jest.mock('@/components/sheets/AdaptiveActionSheet', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({children, onBeforeClose}: MockSheetProps) => (
      <MockView testID="sheet" onBeforeClose={onBeforeClose}>
        {children}
      </MockView>
    ),
  };
});
const mockHideSheet = jest.fn();
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {
    show: jest.fn(),
    hide: (...args: unknown[]) => mockHideSheet(...args),
  },
}));
jest.mock('@/components/sheets/SheetGestures', () => {
  const {ScrollView: MockScrollView, View: MockView} =
    jest.requireActual('react-native');
  return {
    SheetScrollView: MockScrollView,
    SheetNoDrag: MockView,
    SheetFooter: (props: object) => (
      <MockView {...props} testID="sheet-footer" />
    ),
  };
});
jest.mock('react-native-reanimated', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {View: MockView},
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: number) => ({value: v}),
    withTiming: (v: number) => v,
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {text: '#111111', textSecondary: '#555555', background: '#fff'},
    },
  }),
}));
jest.mock('@expo/vector-icons', () => ({Ionicons: () => null}));
jest.mock('@/store/mushafSettingsStore', () => {
  const settings = {rewayah: 'hafs'};
  const useMushafSettingsStore = (select: (s: object) => unknown) =>
    select(settings);
  useMushafSettingsStore.getState = () => settings;
  return {useMushafSettingsStore};
});
jest.mock('@/hooks/useRewayahVerseUnits', () => ({
  useRewayahVerseUnits: () => ({units: null}),
}));
jest.mock('@/utils/playbackVerseUnits', () => ({
  readyVerseUnits: () => null,
  canShowRewayahVerses: () => true,
  subscribeVerseUnitsChanges: () => () => undefined,
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {
    getOrderedVerseKeysForPage: () => ['2:30', '2:31', '2:32'],
  },
}));

// mushafPlayerStore's playback dependencies: no timings can be loaded, so a
// start fails once its surah was asked for.
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

import {MushafPlayerOptionsSheet} from '../MushafPlayerOptionsSheet';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const initial = useMushafPlayerStore.getState();
const st = () => useMushafPlayerStore.getState();
let renderer: TestRenderer.ReactTestRenderer | null = null;

async function open() {
  const props = {
    sheetId: 'mushaf-player-options',
    payload: {currentPage: 5},
  } as SheetProps<'mushaf-player-options'>;
  await act(async () => {
    renderer = TestRenderer.create(<MushafPlayerOptionsSheet {...props} />);
  });
}

/** The sheet goes away: swiped down, backdrop, back, or hidden by Play. */
function close() {
  const sheet = renderer!.root.find(n => n.props.testID === 'sheet');
  act(() => {
    sheet.props.onBeforeClose();
  });
}

/** The sheet's Play button (it starts playback and hides the sheet). */
async function pressPlay() {
  const target = renderer!.root
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === 'Play').length > 0,
    )
    .pop();
  if (!target) throw new Error('no Play button');
  await act(async () => {
    target.props.onPress();
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  mockHideSheet.mockClear();
  useMushafPlayerStore.setState(initial, true);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.restoreAllMocks();
});

it('closed without Play: the start verse it was opened for is forgotten', async () => {
  // Play on a verse before a reciter was chosen
  useMushafPlayerStore.setState({pendingStartVerseKey: '36:1'});
  await open();
  close();
  expect(st().pendingStartVerseKey).toBeNull();
  expect(st().pendingStartUnit).toBeNull();
});

it('closed without Play while nothing plays: a range left by a failed start goes too', async () => {
  useMushafPlayerStore.setState({
    rewayatId: 'hafs-clean',
    reciterName: 'Test Reciter',
    rangeStart: {surah: 112, ayah: 3},
    rangeEnd: {surah: 112, ayah: 4},
  });
  await open();
  close();
  expect(st()).toMatchObject({rangeStart: null, rangeEnd: null});
});

it('closed without Play during playback: the range being played stays', async () => {
  useMushafPlayerStore.setState({
    rewayatId: 'hafs-clean',
    reciterName: 'Test Reciter',
    playbackState: 'paused',
    rangeStart: {surah: 2, ayah: 30},
    rangeEnd: {surah: 2, ayah: 37},
  });
  await open();
  close();
  expect(st().rangeStart).toEqual({surah: 2, ayah: 30});
  expect(st().rangeEnd).toEqual({surah: 2, ayah: 37});
});

it('closed by Play: the range it applied stays, also when the start failed', async () => {
  useMushafPlayerStore.setState({
    rewayatId: 'hafs-clean',
    reciterName: 'Test Reciter',
  });
  await open();
  await pressPlay();
  expect(mockHideSheet).toHaveBeenCalledWith('mushaf-player-options');
  // no timings: the start failed and nothing plays
  expect(st().playbackState).toBe('idle');
  close();
  // the page's first to last verse, kept for a retry with another reciter
  expect(st().rangeStart).toEqual({surah: 2, ayah: 30});
  expect(st().rangeEnd).toEqual({surah: 2, ayah: 32});
});

it('keeps the sheet drag off Play', async () => {
  await open();
  const play = renderer!.root
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === 'Play').length > 0,
    )
    .pop();
  let footer: typeof play | null = play ?? null;
  while (footer && footer.props.testID !== 'sheet-footer') {
    footer = footer.parent;
  }
  expect(footer).toBeTruthy();
});
