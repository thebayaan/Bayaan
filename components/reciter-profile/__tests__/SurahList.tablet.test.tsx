// @ai-generated
import React from 'react';
import {InteractionManager, StyleSheet} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import {SurahList, SurahListTableHeader} from '../components/SurahList';
import {SURAHS} from '@/data/surahData';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#000000', textSecondary: '#666666'}},
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('@/data/juzData', () => ({
  getJuzForSurah: (id: number) => (id < 3 ? 1 : 2),
}));
jest.mock('@/components/SurahItem', () => {
  const {Text} = jest.requireActual('react-native');
  return {
    SurahItem: ({
      item,
      tableColumns,
    }: {
      item: {id: number};
      tableColumns?: boolean;
    }) => (
      <Text testID="row">{`${item.id}:${
        tableColumns ? 'table' : 'phone'
      }`}</Text>
    ),
    SurahTableHeader: () => <Text testID="table-header">header</Text>,
  };
});
jest.mock('@/components/cards/SurahCard', () => {
  const {View} = jest.requireActual('react-native');
  return {
    SurahCard: ({id, style}: {id: number; style: unknown}) => (
      <View testID={`card-${id}`} style={style} />
    ),
  };
});

const surahs = SURAHS.slice(0, 10);

beforeEach(() => {
  // Render every batch at once instead of after the test has finished.
  jest
    .spyOn(InteractionManager, 'runAfterInteractions')
    .mockImplementation(task => {
      if (typeof task === 'function') task();
      return {cancel: jest.fn()} as unknown as ReturnType<
        typeof InteractionManager.runAfterInteractions
      >;
    });
});

function render(props: {
  viewMode: 'list' | 'card';
  tabletMargin?: number;
  hideTableHeader?: boolean;
}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <SurahList
        inline
        surahs={surahs}
        onSurahPress={jest.fn()}
        reciterId="r"
        isLoved={() => false}
        isDownloaded={() => false}
        onOptionsPress={jest.fn()}
        sortOption="asc"
        getColorForSurah={() => '#cccccc'}
        {...props}
      />,
    );
  });
  return renderer;
}

function layout(renderer: TestRenderer.ReactTestRenderer, width: number) {
  const container = renderer.root.find(
    n => typeof n.type === 'string' && typeof n.props.onLayout === 'function',
  );
  act(() => container.props.onLayout({nativeEvent: {layout: {width}}}));
}

const rows = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root
    .findAll(n => n.props.testID === 'row' && typeof n.type !== 'string')
    .map(n => n.props.children as string);

const hasHeader = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root.findAll(
    n => n.props.testID === 'table-header' && typeof n.type !== 'string',
  ).length > 0;

describe('SurahList on iPad', () => {
  it('keeps phone rows without a tablet margin', () => {
    const renderer = render({viewMode: 'list'});
    expect(hasHeader(renderer)).toBe(false);
    expect(rows(renderer).every(r => r.endsWith(':phone'))).toBe(true);
  });

  it('shows the table on a wide pane', () => {
    const renderer = render({viewMode: 'list', tabletMargin: 32});
    layout(renderer, 944);
    expect(hasHeader(renderer)).toBe(true);
    expect(rows(renderer)).toHaveLength(10);
    expect(rows(renderer).every(r => r.endsWith(':table'))).toBe(true);
  });

  it('keeps plain rows on a narrow pane such as the iPad mini', () => {
    const renderer = render({viewMode: 'list', tabletMargin: 24});
    layout(renderer, 656);
    expect(hasHeader(renderer)).toBe(false);
    expect(rows(renderer).every(r => r.endsWith(':phone'))).toBe(true);
  });

  it('flows cards into equal columns that fit the pane', () => {
    const renderer = render({viewMode: 'card', tabletMargin: 32});
    layout(renderer, 944);
    const widths = renderer.root
      .findAll(
        n =>
          typeof n.type === 'string' &&
          String(n.props.testID ?? '').startsWith('card-'),
      )
      .map(n => StyleSheet.flatten(n.props.style).width as number);
    expect(widths).toHaveLength(10);
    expect(new Set(widths).size).toBe(1);
    // Whole points, so rounding to the pixel grid never wraps a row early.
    expect(Number.isInteger(widths[0])).toBe(true);
    // More than the phone's two columns.
    expect(widths[0]).toBeLessThan((944 - 64) / 3);
  });

  it('leaves the header to the screen when it pins its own', () => {
    const renderer = render({
      viewMode: 'list',
      tabletMargin: 32,
      hideTableHeader: true,
    });
    layout(renderer, 944);
    expect(hasHeader(renderer)).toBe(false);
    expect(rows(renderer).every(r => r.endsWith(':table'))).toBe(true);
  });

  it('lines the pinned header up with the list rows', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<SurahListTableHeader margin={32} />);
    });
    expect(hasHeader(renderer)).toBe(true);
    const list = render({viewMode: 'list', tabletMargin: 32});
    const listPadding = StyleSheet.flatten(
      list.root.find(
        n =>
          typeof n.type === 'string' && typeof n.props.onLayout === 'function',
      ).props.style,
    ).paddingHorizontal;
    const headerPadding = StyleSheet.flatten(
      renderer.root.findAll(n => typeof n.type === 'string')[0].props.style,
    ).paddingHorizontal;
    expect(headerPadding).toBe(listPadding);
  });
});
