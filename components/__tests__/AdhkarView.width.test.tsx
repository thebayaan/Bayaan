// @ai-generated
import React from 'react';
import {ScrollView} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

const mockCards: {width: number; height: number; tablet?: boolean}[] = [];
const mockHeroes: {width?: number}[] = [];
let mockIsTablet = true;
let mockSavedIds = new Set<string>(['saved-1']);
jest.mock('@/components/adhkar/AdhkarBentoCard', () => ({
  AdhkarBentoCard: (props: {width: number; height: number}) => {
    mockCards.push(props);
    return null;
  },
  TABLET_LABEL_OVERHEAD: 48,
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: mockIsTablet}),
}));
jest.mock('@/components/adhkar/AdhkarNowPlayingCard', () => ({
  AdhkarNowPlayingCard: () => null,
  useHasAdhkarSession: () => false,
}));
jest.mock('@/components/hero/SavedAdhkarHero', () => ({
  SavedAdhkarHero: (props: {width?: number}) => {
    mockHeroes.push(props);
    return null;
  },
}));
jest.mock('@/components/LoadingIndicator', () => ({
  LoadingIndicator: () => null,
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {colors: {text: '#000', error: '#f00'}}}),
}));
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('@/hooks/useAdhkar', () => ({
  useAdhkar: () => ({
    error: null,
    superCategoriesLoaded: true,
    savedIds: mockSavedIds,
    mainSuperCategories: [
      {id: 'a', column: 'left', sortOrder: 1},
      {id: 'b', column: 'right', sortOrder: 1},
    ],
    otherSuperCategories: [],
  }),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 1032, height: 1376, scale: 2, fontScale: 1}),
}));

import {
  AdhkarView,
  adhkarTabletLayout,
  adhkarTileDimensions,
} from '@/components/AdhkarView';

function renderAt(paneWidth: number) {
  let r = {} as TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(
      <AdhkarView
        onCategoryPress={jest.fn()}
        onSavedPress={jest.fn()}
        headerHeight={0}
      />,
    );
  });
  const [scroll] = r.root.findAll(n => (n.type as unknown) === ScrollView);
  mockCards.length = 0;
  mockHeroes.length = 0;
  act(() => {
    scroll.props.onLayout({
      nativeEvent: {layout: {width: paneWidth, height: 900}},
    });
  });
  return r;
}

beforeEach(() => {
  mockIsTablet = true;
  mockSavedIds = new Set(['saved-1']);
});

it('sizes the iPad grid from the measured pane, not the window', () => {
  // A 944pt pane beside the rail in a 1032pt window: 32pt margins, 20pt
  // gutters, so five 160pt cards fit.
  const r = renderAt(944);
  const layout = adhkarTabletLayout(944, 1032);
  expect(layout).toMatchObject({margin: 32, gap: 20, numColumns: 5});
  expect(layout.columnWidth * 5 + 20 * 4 + 32 * 2).toBeCloseTo(944);

  const [first] = mockCards.slice(-2);
  expect(first.tablet).toBe(true);
  expect(first.width).toBeCloseTo(layout.columnWidth);
  // A 3:2 image plus room for a two-line label.
  expect(first.height).toBeCloseTo((layout.columnWidth * 2) / 3 + 48);
  // The saved hero spans the grid, so no empty gap sits beside it.
  expect(mockHeroes[mockHeroes.length - 1].width).toBeCloseTo(944 - 32 * 2);
  expect(layout.heroWidth).toBeCloseTo(layout.columnWidth * 5 + layout.gap * 4);
  act(() => r.unmount());
});

it('leaves the hero out on iPad when nothing is saved or playing', () => {
  mockSavedIds = new Set();
  const r = renderAt(944);
  expect(mockHeroes).toHaveLength(0);
  act(() => r.unmount());
});

it('keeps two columns on a narrow pane', () => {
  expect(adhkarTabletLayout(400, 834).numColumns).toBe(2);
});

it('sizes the two columns from the measured container, not the window', () => {
  mockIsTablet = false;
  let r: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    r = TestRenderer.create(
      <AdhkarView
        onCategoryPress={jest.fn()}
        onSavedPress={jest.fn()}
        headerHeight={0}
      />,
    );
  });
  const [scroll] = r!.root.findAll(n => (n.type as unknown) === ScrollView);
  mockCards.length = 0;
  act(() => {
    scroll.props.onLayout({nativeEvent: {layout: {width: 720, height: 900}}});
  });

  const [first] = mockCards.slice(-2);
  const {horizontalPadding} = adhkarTileDimensions(720, 0);
  // Two cards, one gap and both side paddings fill exactly 720pt.
  const gap = 720 - horizontalPadding * 2 - first.width * 2;
  expect(gap).toBeGreaterThan(0);
  expect(gap).toBeLessThan(30);
  expect(first.width).toBeCloseTo(adhkarTileDimensions(720, gap).columnWidth);
  // Window math would have sized them for 1032pt.
  expect(first.width).toBeLessThan(
    adhkarTileDimensions(1032, gap).columnWidth - 100,
  );
  act(() => r!.unmount());
});

it('splits the width into two columns with one gap', () => {
  const {columnWidth, cardHeight, horizontalPadding} = adhkarTileDimensions(
    400,
    10,
  );
  expect(columnWidth * 2 + 10 + horizontalPadding * 2).toBeCloseTo(400);
  expect(cardHeight).toBeCloseTo((columnWidth * 2) / 3);
});
