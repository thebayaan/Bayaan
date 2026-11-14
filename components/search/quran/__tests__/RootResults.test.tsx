// @ai-generated
/**
 * RootResults (the word view's root screen) with useQuranRootSearch mocked:
 * the counts, the lemma chips, filtering by a lemma, the word's own lemma
 * preselected, and the missing root.
 */
import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import {RootResults} from '../RootResults';
import type {QuranRootSearchState} from '@/hooks/useQuranSearch';
import type {RootSearchResult} from '@/services/search/QuranSearchDataService';
import {verseKeyAt} from '@/utils/search/quranIndexFormat';
import type {QuranVerseHit} from '@/utils/search/quranSearch';

jest.mock('@shopify/flash-list', () => {
  const ReactActual = jest.requireActual('react');
  return {
    FlashList: (props: {
      data: {key: string}[];
      renderItem: (info: {item: unknown; index: number}) => unknown;
    }) =>
      ReactActual.createElement(
        ReactActual.Fragment,
        null,
        props.data.map((item, index) =>
          ReactActual.createElement(
            ReactActual.Fragment,
            {key: item.key},
            props.renderItem({item, index}),
          ),
        ),
      ),
  };
});
jest.mock('react-native-actions-sheet', () => ({ScrollView: () => null}));
jest.mock('../VerseHitRow', () => {
  const {Text: MockText} = jest.requireActual('react-native');
  return {
    VerseHitRow: ({hit}: {hit: {verseKey: string}}) => (
      <MockText testID="verse">{hit.verseKey}</MockText>
    ),
  };
});
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#000000', textSecondary: '#666666', background: '#fff'},
      fonts: {semiBold: 's', medium: 'm'},
    },
  }),
}));

let mockState: QuranRootSearchState = {status: 'loading', result: null};
jest.mock('@/hooks/useQuranSearch', () => ({
  useQuranRootSearch: () => mockState,
}));

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const hit = (verseIndex: number): QuranVerseHit => ({
  verseIndex,
  verseKey: verseKeyAt(verseIndex),
  matches: [{position: 1, length: 1}],
  score: 1,
});

const result: RootSearchResult = {
  root: {id: 7, root: 'ر ح م', words: 339, ayahs: 313},
  lemmas: [
    {id: 1, rootId: 7, lemma: 'رَّحِيم', words: 116, ayahs: 95},
    {id: 2, rootId: 7, lemma: 'رَحْمَة', words: 114, ayahs: 110},
    {id: 3, rootId: 7, lemma: null, words: 2, ayahs: 2},
  ],
  hits: lemmaId => {
    if (lemmaId === 1) return [hit(0), hit(2)];
    if (lemmaId === 2) return [hit(5)];
    if (lemmaId === 3) return [hit(9)];
    return [hit(0), hit(2), hit(5), hit(9)];
  },
};

function render(props: Partial<React.ComponentProps<typeof RootResults>> = {}) {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(
      <RootResults root="ر ح م" onVersePress={jest.fn()} {...props} />,
    );
  });
  return (renderer as TestRenderer.ReactTestRenderer).root;
}

const textNodes = (root: TestRenderer.ReactTestInstance) => {
  const text: unknown = Text;
  return root.findAll(node => node.type === text);
};
const texts = (root: TestRenderer.ReactTestInstance) =>
  textNodes(root).map(node => String(node.props.children));
const verses = (root: TestRenderer.ReactTestInstance) =>
  textNodes(root)
    .filter(node => node.props.testID === 'verse')
    .map(node => node.props.children);
const tab = (root: TestRenderer.ReactTestInstance, label: string) =>
  root.find(
    node =>
      node.props.accessibilityRole === 'tab' &&
      typeof node.props.accessibilityLabel === 'string' &&
      node.props.accessibilityLabel.startsWith(label) &&
      typeof node.props.onPress === 'function',
  );

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

describe('RootResults', () => {
  it('shows a loading row first', () => {
    mockState = {status: 'loading', result: null};
    expect(texts(render())).toContain('Searching the Quran…');
  });

  it('shows the root, its counts and a chip per lemma', () => {
    mockState = {status: 'done', result};
    const root = render();
    const all = texts(root);
    expect(all).toContain('Root \u{2068}ر ح م\u{2069}');
    expect(all).toContain('339 words in 313 ayahs');
    expect(all).toEqual(
      expect.arrayContaining([
        'All forms',
        'رَّحِيم',
        'رَحْمَة',
        'Other forms',
      ]),
    );
    expect(all).toEqual(expect.arrayContaining(['339', '116', '114', '2']));
    expect(verses(root)).toEqual(['1:1', '1:3', '1:6', '2:3']);
  });

  it('filters the ayahs by the lemma chosen', () => {
    mockState = {status: 'done', result};
    const root = render();
    act(() => tab(root, 'رَحْمَة').props.onPress());
    expect(verses(root)).toEqual(['1:6']);
    expect(tab(root, 'رَحْمَة').props.accessibilityState).toEqual({
      selected: true,
    });
    act(() => tab(root, 'All forms').props.onPress());
    expect(verses(root)).toEqual(['1:1', '1:3', '1:6', '2:3']);
  });

  it("starts on the word's own lemma", () => {
    mockState = {status: 'done', result};
    const root = render({initialLemma: 'رَّحِيم'});
    expect(verses(root)).toEqual(['1:1', '1:3']);
    expect(tab(root, 'رَّحِيم').props.accessibilityState).toEqual({
      selected: true,
    });
  });

  it('says when the Quran has no such root', () => {
    mockState = {status: 'missing', result: null};
    expect(texts(render({root: 'ظ ظ ظ'}))).toContain(
      'No root “\u{2068}ظ ظ ظ\u{2069}” in the Quran',
    );
  });

  it('says when the search failed', () => {
    mockState = {status: 'error', result: null};
    expect(texts(render())).toContain("Couldn't search the Quran text.");
  });
});
