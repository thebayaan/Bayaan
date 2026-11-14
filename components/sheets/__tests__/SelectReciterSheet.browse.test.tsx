// @ai-generated
/**
 * "Browse all reciters" in the select-reciter sheet opens the reciter
 * browser in the tab the sheet was opened over, so going back after
 * choosing a reciter returns there. It used to open Home's browser from
 * every tab but Search.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

let mockSegments: string[] = [];
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({push: mockPush}),
  useSegments: () => mockSegments,
}));

jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {hide: jest.fn()},
}));

jest.mock('@/components/sheets/AdaptiveActionSheet', () => ({
  __esModule: true,
  default: ({children}: {children: React.ReactNode}) => children,
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#000', background: '#fff', textSecondary: '#666'}},
  }),
}));

jest.mock('@/store/reciterStore', () => ({
  useReciterStore: (select: (s: {defaultReciter: null}) => unknown) =>
    select({defaultReciter: null}),
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

jest.mock('@/services/dataService', () => ({
  getSurahById: jest.fn(async () => null),
}));

jest.mock('@expo/vector-icons', () => ({Ionicons: () => null}));
jest.mock('@/components/Icons', () => ({DiscoverIcon: () => null}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

import {SelectReciterSheet} from '@/components/sheets/SelectReciterSheet';

async function browseAllFrom(segments: string[]) {
  mockSegments = segments;
  const props = {
    sheetId: 'select-reciter',
    payload: {surahId: '36'},
  } as React.ComponentProps<typeof SelectReciterSheet>;
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    renderer = TestRenderer.create(<SelectReciterSheet {...props} />);
  });
  if (!renderer) throw new Error('sheet did not render');
  const option = renderer.root
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === 'selectReciter.browseAll').length >
          0,
    )
    .pop();
  if (!option) throw new Error('no Browse all option');
  act(() => {
    option.props.onPress();
  });
}

beforeEach(() => {
  mockPush.mockClear();
});

it.each([
  [['(tabs)', '(b.surahs)'], '(b.surahs)'],
  [['(tabs)', '(b.search)'], '(b.search)'],
  [['(tabs)', '(b.search)', 'browse-all-surahs'], '(b.search)'],
  [['(tabs)', '(a.home)', 'browse-all-surahs'], '(a.home)'],
])('from %j opens the browser in %s', async (segments, stack) => {
  await browseAllFrom(segments);
  expect(mockPush).toHaveBeenCalledWith({
    pathname: `/(tabs)/${stack}/reciter/browse`,
    params: {view: 'all', surahId: '36'},
  });
});
