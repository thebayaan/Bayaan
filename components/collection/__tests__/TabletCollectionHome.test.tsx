// @ai-generated
import React from 'react';
import {Text, View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

// Strings come from the app's English resources (test-utils/setupI18n.ts).

const mockPush = jest.fn();
let mockWindowWidth = 1024;

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {text: '#111111', textSecondary: '#555555', background: '#fff'},
    },
  }),
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 24, bottom: 20, left: 0, right: 0}),
}));
jest.mock('expo-router', () => ({useRouter: () => ({push: mockPush})}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/components/cards/PlaylistCard', () => ({
  PlaylistCard: () => null,
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: mockWindowWidth, height: 768}),
}));

import {PlaylistCard} from '@/components/cards/PlaylistCard';
import type {UserPlaylist} from '@/services/database/DatabaseService';
import {
  TabletCollectionHome,
  collectionSpacing,
  type CollectionCategory,
} from '../TabletCollectionHome';

const categories: CollectionCategory[] = [
  {
    id: 'loved',
    label: 'Loved',
    icon: null,
    color: '#FF6B6B',
    count: 3,
    emptyText: 'Nothing loved yet',
    route: '/collection/loved',
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: null,
    color: '#3B82F6',
    count: 0,
    emptyText: 'No notes yet',
    route: '/collection/notes',
  },
];

const playlist = (id: string): UserPlaylist =>
  ({id, name: `List ${id}`, itemCount: 2, color: '#6366F1'}) as UserPlaylist;

function render(
  props: Partial<React.ComponentProps<typeof TabletCollectionHome>> = {},
  paneWidth = 760,
) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <TabletCollectionHome
        categories={categories}
        playlists={[]}
        onAdd={jest.fn()}
        {...props}
      />,
    );
  });
  const pane = renderer.root.find(
    n => (n.type as unknown) === View && typeof n.props.onLayout === 'function',
  );
  act(() => {
    pane.props.onLayout({nativeEvent: {layout: {width: paneWidth}}});
  });
  return renderer;
}

const texts = (node: TestRenderer.ReactTestInstance) =>
  node
    .findAll(n => (n.type as unknown) === Text)
    .map(n => [n.props.children].flat().join(''));

/** The innermost pressable whose label starts with `label`. */
const button = (r: TestRenderer.ReactTestRenderer, label: string) => {
  const matches = r.root.findAll(
    n =>
      typeof n.props.onPress === 'function' &&
      typeof n.props.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith(label),
  );
  return matches[matches.length - 1];
};

/** The style of the tile labelled `label`, resolved for an unpressed state. */
const tileWidth = (r: TestRenderer.ReactTestRenderer, label: string) => {
  const style = [button(r, label).props.style({pressed: false})].flat();
  return Object.assign({}, ...style).width;
};

beforeEach(() => {
  mockPush.mockClear();
  mockWindowWidth = 1024;
});

describe('collectionSpacing', () => {
  it('follows the width classes', () => {
    expect(collectionSpacing(744)).toEqual({margin: 24, gap: 16});
    expect(collectionSpacing(1024)).toEqual({margin: 32, gap: 20});
    expect(collectionSpacing(1366)).toEqual({margin: 40, gap: 24});
  });
});

describe('TabletCollectionHome', () => {
  it('shows each category with its count, or its empty text', () => {
    const r = render();
    expect(texts(button(r, 'Loved'))).toEqual(['Loved', '3 items']);
    expect(texts(button(r, 'Notes'))).toEqual(['Notes', 'No notes yet']);
  });

  it('lets an empty hint wrap instead of cutting it off', () => {
    const r = render();
    const hint = button(r, 'Notes').find(
      n => (n.type as unknown) === Text && n.props.children === 'No notes yet',
    );
    expect(hint.props.numberOfLines).toBe(2);
  });

  it('opens a category route', () => {
    const r = render();
    act(() => button(r, 'Notes').props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/collection/notes');
  });

  it('sizes the tiles from the pane', () => {
    // 760 pane, 32 margins, 20 gap: three 212pt columns fit, at 200pt min.
    const r = render({}, 760);
    expect(tileWidth(r, 'Loved')).toBeCloseTo((760 - 64 - 40) / 3);
    // A narrow pane keeps two columns.
    const narrow = render({}, 400);
    expect(tileWidth(narrow, 'Loved')).toBeCloseTo((400 - 64 - 20) / 2);
  });

  it('calls onAdd from the add button', () => {
    const onAdd = jest.fn();
    const r = render({onAdd});
    act(() => button(r, 'Add to Collection').props.onPress());
    expect(onAdd).toHaveBeenCalled();
  });

  it('hides the playlists shelf when there are none', () => {
    const r = render();
    expect(
      r.root.findAll(n => (n.type as unknown) === PlaylistCard),
    ).toHaveLength(0);
    expect(texts(r.root)).not.toContain('See All');
  });

  it('shows a playlists shelf that opens each playlist', () => {
    const r = render({playlists: [playlist('a'), playlist('b')]});
    const cards = r.root.findAll(n => (n.type as unknown) === PlaylistCard);
    expect(cards.map(c => c.props.name)).toEqual(['List a', 'List b']);
    expect(cards[0].props.width).toBe(cards[0].props.height);
    act(() => cards[1].props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/playlist/b');
  });
});
