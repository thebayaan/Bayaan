// @ai-generated
import React from 'react';
import {StyleSheet, Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import {TabletSearchResults, groupResults} from '../TabletSearchResults';
import type {CatalogSearchResult} from '@/utils/search/catalog';
import type {Surah} from '@/data/surahData';
import type {Reciter} from '@/data/reciterData';

let mockWindowWidth = 1032;
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({width: mockWindowWidth, isTablet: true}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#000000',
        textSecondary: '#666666',
        background: '#ffffff',
      },
      fonts: {bold: 'b', semiBold: 's', medium: 'm'},
    },
  }),
}));
jest.mock('@/components/SurahItem', () => {
  const {Text: MockText} = jest.requireActual('react-native');
  return {
    SurahItem: ({item}: {item: {name: string}}) => (
      <MockText testID="surah-row">{item.name}</MockText>
    ),
  };
});
jest.mock('@/components/ReciterImage', () => ({ReciterImage: () => null}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/i18n/format', () => ({
  getReciterDisplayName: (r: {name: string}) => r.name,
  getSurahDisplayName: (s: {name: string}) => s.name,
  getSurahMeaning: () => null,
  localizeDigits: (n: number) => String(n),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

const surah = (id: number): CatalogSearchResult => ({
  type: 'surah',
  item: {id, name: `Surah ${id}`, verses_count: 7} as unknown as Surah,
  score: 1,
});
const reciter = (id: string): CatalogSearchResult => ({
  type: 'reciter',
  item: {id, name: `Reciter ${id}`, rewayat: []} as unknown as Reciter,
  score: 1,
});

const results = [
  reciter('a'),
  surah(1),
  surah(2),
  reciter('b'),
  surah(3),
  surah(4),
  surah(5),
  surah(6),
];

function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <TabletSearchResults
        results={results}
        onResultPress={jest.fn()}
        onSurahPlay={jest.fn()}
        onSurahOptions={jest.fn()}
        bottomPadding={0}
      />,
    );
  });
  return renderer;
}

function surahRows(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAll(n => n.props.testID === 'surah-row' && typeof n.type !== 'string')
    .map(n => n.props.children);
}

function texts(renderer: TestRenderer.ReactTestRenderer) {
  const text: unknown = Text;
  return renderer.root
    .findAll(n => n.type === text)
    .map(n => n.props.children)
    .flat();
}

function pressTab(renderer: TestRenderer.ReactTestRenderer, label: string) {
  const tab = renderer.root.find(
    n =>
      n.props.accessibilityRole === 'tab' &&
      typeof n.props.onPress === 'function' &&
      typeof n.type !== 'string' &&
      n.findAll(c => c.props.children === label).length > 0,
  );
  act(() => tab.props.onPress());
}

beforeEach(() => {
  mockWindowWidth = 1032;
});

/** Whether the top result and the surah list share one row. */
function topLayout(renderer: TestRenderer.ReactTestRenderer) {
  const sharedRows = renderer.root.findAll(
    n =>
      (n.type as unknown) === 'View' &&
      StyleSheet.flatten(n.props.style)?.flexDirection === 'row' &&
      n.findAll(c => c.props.children === 'search.topResult').length > 0 &&
      n.findAll(c => c.props.testID === 'surah-row').length > 0,
  );
  return sharedRows.length > 0 ? 'side-by-side' : 'stacked';
}

describe('groupResults', () => {
  it('keeps rank order and puts the best hit on top', () => {
    const grouped = groupResults(results);
    expect(grouped.top).toBe(results[0]);
    expect(grouped.reciters.map(r => r.item.id)).toEqual(['a', 'b']);
    expect(grouped.surahs.map(r => r.item.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('TabletSearchResults', () => {
  it('shows the top result, four surahs and the other reciters in All', () => {
    const renderer = render();
    expect(texts(renderer)).toContain('search.topResult');
    expect(texts(renderer)).toContain('Reciter a');
    expect(surahRows(renderer)).toEqual([
      'Surah 1',
      'Surah 2',
      'Surah 3',
      'Surah 4',
    ]);
    // The top reciter is not repeated in the shelf.
    expect(texts(renderer).filter(s => s === 'Reciter a')).toHaveLength(1);
    expect(texts(renderer)).toContain('Reciter b');
  });

  it('lists every surah in the Surahs scope', () => {
    const renderer = render();
    pressTab(renderer, 'common:terms.surahs');
    expect(surahRows(renderer)).toHaveLength(6);
    expect(texts(renderer)).not.toContain('search.topResult');
  });

  it('lists every reciter in the Reciters scope', () => {
    const renderer = render();
    pressTab(renderer, 'common:terms.reciters');
    const grid = renderer.root.find(
      n => typeof n.type === 'string' && typeof n.props.onLayout === 'function',
    );
    act(() => grid.props.onLayout({nativeEvent: {layout: {width: 896}}}));
    expect(surahRows(renderer)).toHaveLength(0);
    expect(texts(renderer)).toEqual(
      expect.arrayContaining(['Reciter a', 'Reciter b']),
    );
    // Whole-point tiles, so a row filled exactly never wraps early.
    const tileWidths = grid
      .findAll(
        n =>
          typeof n.type === 'string' && n.props.accessibilityRole === 'button',
      )
      .map(n => StyleSheet.flatten(n.props.style).width);
    expect(tileWidths.length).toBeGreaterThan(0);
    expect(tileWidths.every(w => Number.isInteger(w))).toBe(true);
  });

  it('gives every surah row a play button', () => {
    const onSurahPlay = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <TabletSearchResults
          results={[surah(1), surah(2)]}
          onResultPress={jest.fn()}
          onSurahPlay={onSurahPlay}
          onSurahOptions={jest.fn()}
          bottomPadding={0}
        />,
      );
    });
    const plays = renderer.root.findAll(
      n =>
        n.props.accessibilityLabel === 'actions.play' &&
        typeof n.props.onPress === 'function',
    );
    // The top result card plus the one other surah row.
    expect(plays.length).toBeGreaterThanOrEqual(2);
    act(() => plays[plays.length - 1].props.onPress());
    expect(onSurahPlay).toHaveBeenCalledWith(
      expect.objectContaining({item: expect.objectContaining({id: 2})}),
    );
  });

  it('puts the top result beside the surahs on a 13-inch iPad', () => {
    const renderer = render();
    expect(topLayout(renderer)).toBe('side-by-side');
  });

  it('stacks the top result above the surahs on an iPad mini', () => {
    mockWindowWidth = 744;
    expect(topLayout(render())).toBe('stacked');
  });

  it('opens the options for a surah row', () => {
    const onSurahOptions = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <TabletSearchResults
          results={[surah(1), surah(2)]}
          onResultPress={jest.fn()}
          onSurahPlay={jest.fn()}
          onSurahOptions={onSurahOptions}
          bottomPadding={0}
        />,
      );
    });
    const more = renderer.root.findAll(
      n =>
        n.props.accessibilityLabel === 'surahItem.moreOptions' &&
        typeof n.props.onPress === 'function',
    );
    // One on the top result card, one on the other surah's row.
    expect(more).toHaveLength(2);
    act(() => more[0].props.onPress());
    act(() => more[1].props.onPress());
    expect(onSurahOptions.mock.calls.map(([r]) => r.item.id)).toEqual([1, 2]);
  });

  it('gives a lone result the full width on a 13-inch iPad', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <TabletSearchResults
          results={[surah(18)]}
          onResultPress={jest.fn()}
          onSurahPlay={jest.fn()}
          onSurahOptions={jest.fn()}
          bottomPadding={0}
        />,
      );
    });
    // The tall card pins its buttons in its corner; the full-width row
    // keeps them inline.
    const pinned = renderer.root.findAll(
      n =>
        (n.type as unknown) === 'View' &&
        StyleSheet.flatten(n.props.style)?.position === 'absolute',
    );
    expect(pinned).toHaveLength(0);
    expect(texts(renderer)).toContain('search.topResult');
  });

  it('flows the Surahs scope into two columns on a 13-inch iPad', () => {
    const renderer = render();
    pressTab(renderer, 'common:terms.surahs');
    const cells = renderer.root.findAll(
      n =>
        (n.type as unknown) === 'View' &&
        StyleSheet.flatten(n.props.style)?.width === '50%',
    );
    expect(cells).toHaveLength(6);
  });

  it('keeps the Surahs scope in one column on an iPad mini', () => {
    mockWindowWidth = 744;
    const renderer = render();
    pressTab(renderer, 'common:terms.surahs');
    const cells = renderer.root.findAll(
      n =>
        (n.type as unknown) === 'View' &&
        StyleSheet.flatten(n.props.style)?.width === '50%',
    );
    expect(cells).toHaveLength(0);
    expect(surahRows(renderer)).toHaveLength(6);
  });
});
