// @ai-generated
// The Saved adhkar list when the saved set changes under it (tests cannot
// live under app/: expo-router would treat them as routes).
import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {useAdhkarStore} from '@/store/adhkarStore';
import type {Dhikr} from '@/types/adhkar';

function mockDhikr(id: string): Dhikr {
  return {
    id,
    categoryId: 'c1',
    arabic: id,
    translation: null,
    transliteration: null,
    instruction: null,
    repeatCount: 1,
    audioFile: `${id}.mp3`,
    sortOrder: 0,
  };
}

// What the database holds: the screen reads it, the reader changes it.
let mockSavedInDb: string[] = [];
const mockGetSaved = jest.fn(async () =>
  mockSavedInDb.map(dhikrId => ({dhikrId, createdAt: 0})),
);

jest.mock('@/services/adhkar/AdhkarService', () => ({
  adhkarService: {
    getSaved: () => mockGetSaved(),
    getDhikr: async (id: string) => mockDhikr(id),
  },
}));
jest.mock('expo-router', () => {
  const MockReact = jest.requireActual('react');
  const Link = ({children}: {children: React.ReactNode}) =>
    MockReact.createElement(MockReact.Fragment, null, children);
  Link.AppleZoom = Link;
  return {
    useRouter: () => ({push: jest.fn()}),
    useNavigation: () => ({setOptions: jest.fn()}),
    useFocusEffect: () => undefined,
    Link,
  };
});
jest.mock('expo-router/react-navigation', () => ({useHeaderHeight: () => 0}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {text: '#111', textSecondary: '#666', background: '#fff'},
      fonts: {regular: 'Regular', semiBold: 'SemiBold'},
    },
  }),
}));
jest.mock('@/hooks/useAdhkar', () => ({
  useAdhkar: () => ({
    savedIds: jest
      .requireActual('@/store/adhkarStore')
      .useAdhkarStore((s: {savedIds: Set<string>}) => s.savedIds),
  }),
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
jest.mock('@/components/LoadingIndicator', () => ({
  LoadingIndicator: () => null,
}));
jest.mock('@/components/adhkar/DhikrListItem', () => ({
  DhikrListItem: () => null,
}));
jest.mock('@/components/adhkar/PlayAllButton', () => ({
  PlayAllButton: () => null,
}));
jest.mock('@/components/adhkar/AdhkarJumpPill', () => ({
  AdhkarJumpPill: () => null,
  jumpPillDirection: () => null,
  visibleRowIndices: () => [],
}));
jest.mock('@/components/adhkar/DhikrCardRow', () => ({
  ...jest.requireActual('@/components/adhkar/DhikrCardRow'),
  useDhikrColumns: () => ({columns: 1, spacing: null}),
}));
jest.mock('@expo/vector-icons', () => ({Ionicons: () => null}));
jest.mock('@/utils/adhkarAudio', () => ({
  hasAudio: (f: string | null) => f !== null,
}));

import SavedAdhkarScreen from '@/app/(tabs)/(a.home)/adhkar/saved/index';
import {LoadingIndicator} from '@/components/LoadingIndicator';

let screen: ReactTestRenderer;

function setSaved(ids: string[]): void {
  mockSavedInDb = ids;
  useAdhkarStore.setState({savedIds: new Set(ids)});
}
const spinnerShown = (): boolean =>
  screen.root.findAll(node => node.type === LoadingIndicator).length > 0;
// The FlatList: the outermost node that takes the rows.
function list() {
  return screen.root.find(
    node =>
      Array.isArray(node.props.data) &&
      typeof node.props.renderItem === 'function',
  );
}
const shownIds = (): string[] =>
  (list().props.data as Dhikr[][]).flat().map(d => d.id);

beforeEach(async () => {
  mockGetSaved.mockClear();
  setSaved(['a', 'b', 'c']);
  await act(async () => {
    screen = create(<SavedAdhkarScreen />);
  });
});
afterEach(() => {
  act(() => screen.unmount());
});

it('shows the spinner only while the first load runs', async () => {
  act(() => screen.unmount());
  let finishLoad: () => void = () => undefined;
  mockGetSaved.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finishLoad = () => resolve([{dhikrId: 'a', createdAt: 0}]);
      }),
  );
  await act(async () => {
    screen = create(<SavedAdhkarScreen />);
  });
  expect(spinnerShown()).toBe(true);
  await act(async () => {
    finishLoad();
  });
  expect(spinnerShown()).toBe(false);
  expect(shownIds()).toEqual(['a']);
});

it('shows the saved adhkar after the first load', () => {
  expect(spinnerShown()).toBe(false);
  expect(shownIds()).toEqual(['a', 'b', 'c']);
  expect(mockGetSaved).toHaveBeenCalledTimes(1);
});

it('drops an un-saved dhikr in place: no spinner, the list stays mounted', () => {
  const mountedList = list().instance;
  act(() => setSaved(['a', 'c']));
  // Right away, before anything could be reloaded.
  expect(spinnerShown()).toBe(false);
  expect(shownIds()).toEqual(['a', 'c']);
  expect(list().instance).toBe(mountedList);
  expect(mockGetSaved).toHaveBeenCalledTimes(1);
});

it('reloads without a spinner when a dhikr was saved elsewhere', async () => {
  const mountedList = list().instance;
  act(() => setSaved(['a', 'b', 'c', 'd']));
  // The reload is under way; the list is still on screen.
  expect(spinnerShown()).toBe(false);
  expect(list().instance).toBe(mountedList);
  await act(async () => {
    await Promise.resolve();
  });
  expect(shownIds()).toEqual(['a', 'b', 'c', 'd']);
  expect(list().instance).toBe(mountedList);
});

it('shows the empty state when the last one is un-saved', () => {
  act(() => setSaved([]));
  expect(spinnerShown()).toBe(false);
  expect(
    screen.root.findAll(node => Array.isArray(node.props.data)),
  ).toHaveLength(0);
});
