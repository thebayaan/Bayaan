// @ai-generated
// The reader screens' swipe handling in Play All (tests cannot live under
// app/: expo-router would treat them as routes). Both readers share it; the
// list reader stands for both.
import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {toSessionItems} from '@/services/adhkar/playback/sessionReducer';
import {SWIPE_SETTLE_FALLBACK_MS} from '@/components/adhkar/swipeSettle';
import type {Dhikr} from '@/types/adhkar';

const LIST_ID = 'morning-adhkar';
const PAGE = 390;

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
const mockRows = ['a', 'b', 'c'].map(mockDhikr);

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({superId: 'morning-adhkar', dhikrId: 'a'}),
  useRouter: () => ({}),
  useNavigation: () => ({setOptions: jest.fn()}),
  useFocusEffect: () => undefined,
}));
jest.mock('expo-router/react-navigation', () => ({useHeaderHeight: () => 0}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
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
    isSaved: () => false,
    toggleSaved: jest.fn(),
    savedIds: new Set<string>(),
  }),
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
jest.mock('@/components/adhkar/DhikrReader', () => ({DhikrReader: () => null}));
jest.mock('@/components/LoadingIndicator', () => ({
  LoadingIndicator: () => null,
}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/utils/shareUtils', () => ({
  dhikrShareUrl: () => '',
  shareUrl: jest.fn(),
}));
jest.mock('@/utils/adhkarAudio', () => ({
  hasAudio: (f: string | null) => f !== null,
}));
jest.mock('@/utils/adhkarUtils', () => ({
  getSuperCategoryDisplayTitle: () => 'Morning',
  shortenCategoryTitle: (title: string) => title,
}));
jest.mock('@/services/adhkar/AdhkarService', () => ({
  adhkarService: {
    getAdhkarForSuperCategory: async () => ({
      superCategory: {id: 'morning-adhkar', title: 'Morning'},
      categoryGroups: [
        {categoryId: 'c1', categoryTitle: 'Morning', adhkar: mockRows},
      ],
    }),
  },
}));

import DhikrReaderScreen from '@/app/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]';

let screen: ReactTestRenderer;
const session = () => useAdhkarSessionStore.getState().session;

// The FlatList: the outermost node that takes these two callbacks.
function pager() {
  return screen.root.find(
    node =>
      typeof node.props.onViewableItemsChanged === 'function' &&
      typeof node.props.onScrollEndDrag === 'function',
  );
}
// The page at least half visible, as the list reports it.
function show(index: number): void {
  act(() => {
    pager().props.onViewableItemsChanged({
      viewableItems: [{index, item: mockRows[index], isViewable: true}],
      changed: [],
    });
  });
}
function beginDrag(): void {
  act(() => {
    pager().props.onScrollBeginDrag();
  });
}
function liftFinger(offset: number): void {
  act(() => {
    pager().props.onScrollEndDrag({nativeEvent: {contentOffset: {x: offset}}});
  });
}
function comeToRest(): void {
  act(() => {
    pager().props.onMomentumScrollEnd();
  });
}

beforeEach(async () => {
  jest.useFakeTimers();
  useAdhkarSessionStore.setState({session: null, revealToken: 0});
  // Play All of this list, on its first dhikr.
  useAdhkarSessionStore.getState().dispatch({
    type: 'pressPlayAll',
    source: {
      listId: LIST_ID,
      listTitle: 'Morning',
      items: toSessionItems(mockRows),
    },
  });
  await act(async () => {
    screen = create(<DhikrReaderScreen />);
  });
  // The pager renders once its width is measured.
  const measured = screen.root.find(
    node =>
      typeof node.type === 'string' &&
      typeof node.props.onLayout === 'function',
  );
  act(() => {
    measured.props.onLayout({nativeEvent: {layout: {width: PAGE}}});
  });
  show(0);
});

afterEach(() => {
  act(() => screen.unmount());
  jest.useRealTimers();
});

it('keeps playing when a swipe goes past halfway and comes back', () => {
  const before = session();
  beginDrag();
  show(1);
  // Still under the finger: the audio has not moved.
  expect(session()).toBe(before);
  show(0);
  liftFinger(PAGE * 0.2);
  comeToRest();
  // Same dhikr, same clip: nothing was switched or restarted.
  expect(session()).toBe(before);
});

it('moves Play All to the page the swipe settles on', () => {
  beginDrag();
  show(1);
  liftFinger(PAGE * 0.7);
  expect(session()?.index).toBe(0);
  comeToRest();
  expect(session()).toMatchObject({index: 1, status: 'loading'});
});

it('moves it when the finger lifts exactly on the next page', () => {
  beginDrag();
  show(1);
  liftFinger(PAGE);
  expect(session()?.index).toBe(1);
});

it('moves it even when no scroll end arrives', () => {
  beginDrag();
  show(1);
  liftFinger(PAGE * 0.7);
  act(() => {
    jest.advanceTimersByTime(SWIPE_SETTLE_FALLBACK_MS);
  });
  expect(session()?.index).toBe(1);
});

it('lands on the last page of a quick double swipe only', () => {
  beginDrag();
  show(1);
  liftFinger(PAGE * 0.7);
  // Grabbed again before the snap finished.
  beginDrag();
  comeToRest();
  expect(session()?.index).toBe(0);
  show(2);
  liftFinger(PAGE * 1.8);
  comeToRest();
  expect(session()).toMatchObject({index: 2, status: 'loading'});
});

it('still follows a page change that no swipe is behind', () => {
  // As before: for example a report that arrives after the swipe settled.
  show(1);
  expect(session()?.index).toBe(1);
});

it('does not move a single-dhikr session', () => {
  act(() => {
    useAdhkarSessionStore.getState().dispatch({type: 'stop'});
    useAdhkarSessionStore.getState().dispatch({
      type: 'pressCard',
      source: {
        listId: LIST_ID,
        listTitle: 'Morning',
        items: toSessionItems(mockRows),
      },
      index: 0,
    });
  });
  beginDrag();
  show(1);
  liftFinger(PAGE * 0.7);
  comeToRest();
  expect(session()).toMatchObject({index: 0, mode: 'single'});
});
