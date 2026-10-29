// @ai-generated
import React from 'react';
import {StyleSheet, View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

type MockTrack = {
  surahId?: string;
  reciterId?: string;
  rewayatId?: string;
  isUserUpload?: boolean;
};
let mockTracks: MockTrack[] = [];
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (selector: (s: unknown) => unknown) =>
    selector({queue: {tracks: mockTracks, currentIndex: 0}}),
}));
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: (selector: (s: unknown) => unknown) =>
    selector({
      showTranslation: true,
      showTransliteration: false,
      arabicFontSize: 30,
      translationFontSize: 16,
      transliterationFontSize: 14,
    }),
}));
const mockClearSelection = jest.fn();
jest.mock('@/store/verseSelectionStore', () => ({
  useVerseSelectionStore: {
    getState: () => ({clearSelection: mockClearSelection}),
  },
}));

jest.mock('@/components/tablet/TabletPlayerReciterColumn', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    TabletPlayerReciterColumn: (props: object) => (
      <MockView testID="reciters" {...props} />
    ),
  };
});
jest.mock('../QueuePane', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    QueuePane: (props: object) => <MockView testID="queue" {...props} />,
  };
});
jest.mock('../../PlayerContent/QuranView', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    QuranView: (props: object) => <MockView testID="text" {...props} />,
  };
});
jest.mock('../../PlayerContent/UploadPlaceholder', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    UploadPlaceholder: () => <MockView testID="upload" />,
  };
});

import {PlayerPaneBody} from '../PlayerPaneBody';
import type {PlayerPane} from '../PlayerParts';

function render(pane: PlayerPane) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <PlayerPaneBody pane={pane} width={619} bottomInset={272} />,
    );
  });
  return renderer;
}

const find = (renderer: TestRenderer.ReactTestRenderer, id: string) =>
  renderer.root.findAll(
    n => n.props.testID === id && (n.type as unknown) === View,
  );

const parentStyle = (node: TestRenderer.ReactTestInstance) =>
  StyleSheet.flatten(node.parent?.parent?.props.style);

beforeEach(() => {
  mockTracks = [{surahId: '2', reciterId: 'r1', rewayatId: 'hafs'}];
  jest.clearAllMocks();
});

describe('PlayerPaneBody', () => {
  it('shows the verses across the pane, clear of the bottom inset', () => {
    const [text] = find(render('text'), 'text');
    expect(text.props.currentSurah).toBe(2);
    expect(text.props.parentContentWidth).toBe(619);
    expect(text.props.contentPaddingBottom).toBe(272);
    expect(text.props.arabicFontSize).toBe(30);
  });

  it('holds the queue to the reading column, clear of the bottom inset', () => {
    const [queue] = find(render('queue'), 'queue');
    expect(queue.props.bottomInset).toBe(272);
    expect(parentStyle(queue)).toMatchObject({maxWidth: 680});
  });

  it("embeds the current reciter's catalog", () => {
    const [reciters] = find(render('reciters'), 'reciters');
    expect(reciters.props).toMatchObject({
      embedded: true,
      reciterId: 'r1',
      initialRewayatId: 'hafs',
      bottomInset: 272,
    });
    expect(parentStyle(reciters)).toMatchObject({maxWidth: 680});
  });

  it('shows the text when there is no reciter to list', () => {
    mockTracks = [{surahId: '2'}];
    const renderer = render('reciters');
    expect(find(renderer, 'reciters')).toHaveLength(0);
    expect(find(renderer, 'text')).toHaveLength(1);
  });

  it('shows the upload placeholder for an untagged upload', () => {
    mockTracks = [{isUserUpload: true}];
    expect(find(render('text'), 'upload')).toHaveLength(1);
  });

  it('clears any verse selection when the surah changes', () => {
    render('text');
    expect(mockClearSelection).toHaveBeenCalled();
  });
});
