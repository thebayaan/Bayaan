// @ai-generated
// The reader screens' swipe handling in Play All (tests cannot live under
// app/: expo-router would treat them as routes). Both readers share it; the
// list reader stands for both, except where both are run.
import React from 'react';
import {FlatList} from 'react-native';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {toSessionItems} from '@/services/adhkar/playback/sessionReducer';
import {SWIPE_SETTLE_FALLBACK_MS} from '@/components/adhkar/swipeSettle';
import * as rtl from '@/utils/rtl';
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
const mockSavedIds = new Set(mockRows.map(row => row.id));
// The dhikr pages unmounted so far: an unmounted page lost its own state.
const mockUnmountedPages: string[] = [];

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
    savedIds: mockSavedIds,
  }),
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
jest.mock('@/components/adhkar/DhikrReader', () => {
  const {useEffect} = require('react');
  return {
    DhikrReader: ({dhikr}: {dhikr: {id: string}}) => {
      useEffect(
        () => () => {
          mockUnmountedPages.push(dhikr.id);
        },
        [dhikr.id],
      );
      return null;
    },
  };
});
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
    // The Saved reader's rows.
    getSaved: async () =>
      mockRows.map((row, i) => ({dhikrId: row.id, createdAt: i})),
    getDhikr: async (id: string) => mockRows.find(row => row.id === id) ?? null,
  },
}));

import DhikrReaderScreen from '@/app/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]';
import SavedDhikrReaderScreen from '@/app/(tabs)/(a.home)/adhkar/saved/[dhikrId]';

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
// The pager's container is laid out at this width.
function resize(width: number): void {
  const measured = screen.root.find(
    node =>
      typeof node.type === 'string' &&
      typeof node.props.onLayout === 'function',
  );
  act(() => {
    measured.props.onLayout({nativeEvent: {layout: {width}}});
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
  resize(PAGE);
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

// @ai-start
describe('a width change (rotation, Split View)', () => {
  it('keeps every page mounted left to right, scrolled to the same dhikr', () => {
    const scrollToOffset = jest
      .spyOn(FlatList.prototype, 'scrollToOffset')
      .mockImplementation(() => undefined);
    beginDrag();
    show(1);
    liftFinger(PAGE);
    const before = pager();
    mockUnmountedPages.length = 0;
    resize(820);
    // The same list at the new width: no page was unmounted, so each keeps
    // its own scroll position and opened instruction.
    expect(pager()).toBe(before);
    expect(mockUnmountedPages).toEqual([]);
    expect(scrollToOffset).toHaveBeenCalledWith({offset: 820, animated: false});
    expect(session()?.index).toBe(1);
    scrollToOffset.mockRestore();
  });

  describe('in Arabic', () => {
    let direction: jest.ReplaceProperty<boolean>;
    beforeEach(() => {
      direction = jest.replaceProperty(rtl, 'isRTL', true);
    });
    afterEach(() => direction.restore());

    it('remounts the pager on the dhikr that was shown', () => {
      beginDrag();
      show(1);
      liftFinger(PAGE);
      const before = pager();
      expect(before.props.initialScrollIndex).toBe(0);
      resize(820);
      // A fresh list, opened on the same dhikr. Scrolling the old list to
      // the new offset landed elsewhere in Arabic.
      expect(pager()).not.toBe(before);
      expect(pager().props.initialScrollIndex).toBe(1);
      expect(session()?.index).toBe(1);
    });

    it('does not move Play All when the new list reports its page', async () => {
      // Play All is on the third dhikr while the reader opened on the first.
      act(() => screen.unmount());
      const playing = session();
      useAdhkarSessionStore.setState({
        session: playing && {...playing, index: 2},
      });
      await act(async () => {
        screen = create(<DhikrReaderScreen />);
      });
      resize(PAGE);
      show(0);
      const before = session();
      resize(820);
      // The fresh list reports the page it opened on: not a swipe.
      show(0);
      expect(session()).toBe(before);
      expect(session()?.index).toBe(2);
    });
  });
});
// @ai-end

describe.each([
  ['list', DhikrReaderScreen, LIST_ID],
  ['Saved', SavedDhikrReaderScreen, 'saved'],
])(
  'a Play All clip that ends mid-swipe (%s reader)',
  (_name, Screen, listId) => {
    let scrollToIndex: jest.SpyInstance;
    // The token of the clip the session is on now.
    const clipToken = (): number => session()?.trackToken ?? -1;

    beforeEach(async () => {
      scrollToIndex = jest
        .spyOn(FlatList.prototype, 'scrollToIndex')
        .mockImplementation(() => undefined);
      // This reader, with Play All of its own list.
      act(() => screen.unmount());
      useAdhkarSessionStore.setState({session: null, revealToken: 0});
      useAdhkarSessionStore.getState().dispatch({
        type: 'pressPlayAll',
        source: {listId, listTitle: 'Morning', items: toSessionItems(mockRows)},
      });
      await act(async () => {
        screen = create(<Screen />);
      });
      resize(PAGE);
      show(0);
      // A settled swipe to the second dhikr, whose clip then plays.
      beginDrag();
      show(1);
      liftFinger(PAGE);
      act(() => {
        useAdhkarSessionStore
          .getState()
          .dispatch({type: 'playStarted', token: clipToken()});
      });
      expect(session()).toMatchObject({index: 1, status: 'playing'});
      scrollToIndex.mockClear();
    });
    afterEach(() => scrollToIndex.mockRestore());

    // The engine reports the end of the clip it loaded: Play All moves on.
    function clipEnds(): void {
      const token = clipToken();
      act(() => {
        useAdhkarSessionStore.getState().dispatch({type: 'trackEnded', token});
      });
    }

    it('does not scroll the pager under a swipe back, and plays the page it settles on', () => {
      beginDrag();
      show(0);
      clipEnds();
      // The finger is still down: Play All moved on, the pager stays put.
      expect(scrollToIndex).not.toHaveBeenCalled();
      liftFinger(PAGE * 0.4);
      comeToRest();
      expect(scrollToIndex).not.toHaveBeenCalled();
      expect(session()).toMatchObject({index: 0, status: 'loading'});
    });

    it('does not scroll it either when the clip ends as the drag starts', () => {
      beginDrag();
      clipEnds();
      show(0);
      liftFinger(PAGE * 0.4);
      comeToRest();
      expect(scrollToIndex).not.toHaveBeenCalled();
      expect(session()?.index).toBe(0);
    });

    it('follows Play All once a swipe settles back on the page it started on', () => {
      beginDrag();
      clipEnds();
      expect(scrollToIndex).not.toHaveBeenCalled();
      // Lifted back on the second dhikr: the swipe chose no other page.
      liftFinger(PAGE);
      // The pager follows Play All to the third dhikr; the clip that ended
      // does not start again.
      expect(scrollToIndex).toHaveBeenCalledWith({index: 2, animated: true});
      expect(session()?.index).toBe(2);
    });
  },
);
