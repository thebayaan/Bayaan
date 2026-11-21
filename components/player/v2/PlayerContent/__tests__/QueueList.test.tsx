// @ai-generated
// The phone player's queue: which rows take a tap.
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

jest.mock('@/hooks/useReadingThemeColors', () => ({
  useReadingThemeColors: () => ({
    text: '#111111',
    textSecondary: '#666666',
    background: '#FFFFFF',
  }),
}));
jest.mock('@/hooks/usePlayerScrollable', () => ({
  usePlayerScrollable: () => undefined,
}));

type MockTrack = {id: string; title: string; reciterName: string};
let mockQueue: {tracks: MockTrack[]; currentIndex: number};
let mockPlaybackState = 'playing';
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (selector: (s: unknown) => unknown) =>
    selector({queue: mockQueue, playback: {state: mockPlaybackState}}),
}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: (selector: (s: unknown) => unknown) =>
    selector({recitations: []}),
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: () => undefined,
  getSurahById: () => undefined,
}));
jest.mock('@/services/rewayah/RewayahIdentity', () => ({
  getDisplayLabelFromName: (name: string) => name,
}));
jest.mock('@/i18n/format', () => ({
  ...jest.requireActual('@/i18n/format'),
  getTrackDisplayTitle: (track: MockTrack) => track.title,
  getTrackArtistDisplay: () => 'Reciter',
}));
jest.mock('@/components/ReciterImage', () => ({ReciterImage: () => null}));
jest.mock('@/components/NowPlayingIndicator', () => ({
  NowPlayingIndicator: () => null,
}));
jest.mock('@/components/GradientText', () => ({GradientText: () => null}));
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  MaterialCommunityIcons: () => null,
}));
// The real list needs a measured layout; this one renders every row.
interface MockListProps {
  data: unknown[];
  renderItem: (info: {item: unknown; index: number}) => React.ReactNode;
  keyExtractor: (item: unknown) => string;
}
jest.mock('@shopify/flash-list', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    FlashList: (props: MockListProps) => (
      <MockView>
        {props.data.map((item, index) => (
          <MockView key={props.keyExtractor(item)}>
            {props.renderItem({item, index})}
          </MockView>
        ))}
      </MockView>
    ),
  };
});

import {QueueList} from '../QueueList';

const track = (id: string): MockTrack => ({
  id,
  title: `Surah ${id}`,
  reciterName: 'Reciter',
});

const onQueueItemPress = jest.fn();

function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <QueueList
        onQueueItemPress={onQueueItemPress}
        onRemoveQueueItem={jest.fn()}
      />,
    );
  });
  return renderer;
}

const labelled = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll(n => n.props.accessibilityLabel === label);

beforeEach(() => {
  // a was played, b is playing, c is up next.
  mockQueue = {tracks: ['a', 'b', 'c'].map(track), currentIndex: 1};
  mockPlaybackState = 'playing';
  jest.clearAllMocks();
});

describe('QueueList', () => {
  it('jumps to a tapped track', () => {
    const r = render();
    const rows = labelled(r, 'Surah c, Reciter').filter(
      n => typeof n.props.onPress === 'function',
    );
    act(() => rows[rows.length - 1].props.onPress());
    expect(onQueueItemPress).toHaveBeenCalledWith(2);
  });

  // A tap on it used to load the track again: a long surah went back to 0:00.
  it('leaves the playing track alone when its row is tapped', () => {
    const r = render();
    const rows = labelled(r, 'Surah b, Reciter');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.props.onPress).toBeUndefined();
      expect(row.props.accessibilityRole).toBeUndefined();
    }
  });

  // Once the queue has ended, its last surah sits at 0:00 and nothing plays,
  // so a tap loses no place. Play starts the queue over, so the row is the
  // way to hear that surah again.
  it('plays the last track again from its row once the queue has ended', () => {
    mockQueue = {tracks: ['a', 'b', 'c'].map(track), currentIndex: 2};
    mockPlaybackState = 'paused';
    const paused = labelled(render(), 'Surah c, Reciter');
    expect(paused.length).toBeGreaterThan(0);
    expect(paused.every(row => row.props.onPress === undefined)).toBe(true);

    mockPlaybackState = 'ended';
    const rows = labelled(render(), 'Surah c, Reciter').filter(
      n => typeof n.props.onPress === 'function',
    );
    expect(rows.length).toBeGreaterThan(0);
    const row = rows[rows.length - 1];
    expect(row.props.accessibilityRole).toBe('button');
    act(() => row.props.onPress());
    expect(onQueueItemPress).toHaveBeenCalledWith(2);
  });
});
