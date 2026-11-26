// @ai-generated
/**
 * "Browse all reciters" in the reciter sheet opens the picker in the tab the
 * user is in. From Search and Surahs it used to jump to the Home tab, and
 * the user was left on Home after picking.
 */
import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

let mockSegments: string[] = [];
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({push: mockPush}),
  useSegments: () => mockSegments,
}));
const mockHide = jest.fn();
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {hide: (...args: unknown[]) => mockHide(...args)},
}));
jest.mock('@/components/sheets/AdaptiveActionSheet', () => ({
  __esModule: true,
  default: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('@/components/native/NativeSwitch', () => ({
  NativeSwitch: () => null,
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#000000', background: '#ffffff'}},
  }),
}));
jest.mock('@/store/reciterStore', () => ({
  useReciterStore: (select: (state: unknown) => unknown) =>
    select({defaultReciter: null}),
}));
jest.mock('@/services/dataService', () => ({
  getSurahById: (id: number) => ({id, name: `Surah ${id}`}),
}));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    askEveryTime: true,
    setAskEveryTime: jest.fn(),
    setDefaultReciterSelection: jest.fn(),
  }),
}));
jest.mock('@/hooks/useReciterSelection', () => ({
  useReciterSelection: () => ({
    playWithReciter: jest.fn(),
    playWithRandomReciter: jest.fn(),
  }),
}));
jest.mock('@expo/vector-icons', () => ({Ionicons: () => null}));
jest.mock('@/components/Icons', () => ({DiscoverIcon: () => null}));

import {SelectReciterSheet} from '../SelectReciterSheet';

type SheetProps = React.ComponentProps<typeof SelectReciterSheet>;

async function browseAllFrom(segments: string[]) {
  mockSegments = segments;
  let renderer!: TestRenderer.ReactTestRenderer;
  // Async: the sheet looks up the surah's name after mounting.
  await act(async () => {
    renderer = TestRenderer.create(
      <SelectReciterSheet
        {...({
          sheetId: 'select-reciter',
          payload: {surahId: '36'},
        } as SheetProps)}
      />,
    );
  });
  const option = renderer.root.find(
    node =>
      typeof node.type !== 'string' &&
      typeof node.props.onPress === 'function' &&
      node
        .findAll(child => (child.type as unknown) === Text)
        .some(text => text.props.children === 'Browse All Reciters'),
  );
  act(() => {
    option.props.onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

it.each([
  [['(tabs)', '(a.home)', 'browse-all-surahs'], '(a.home)'],
  [['(tabs)', '(b.search)'], '(b.search)'],
  [['(tabs)', '(b.search)', 'browse-all-surahs'], '(b.search)'],
  [['(tabs)', '(b.surahs)'], '(b.surahs)'],
  // A tab with no browse screen of its own.
  [['(tabs)', '(c.collection)'], '(a.home)'],
])('from %j it opens the picker in %s', async (segments, tab) => {
  await browseAllFrom(segments);

  expect(mockHide).toHaveBeenCalledWith('select-reciter');
  expect(mockPush).toHaveBeenCalledWith({
    pathname: `/(tabs)/${tab}/reciter/browse`,
    params: {view: 'all', surahId: '36'},
  });
});
