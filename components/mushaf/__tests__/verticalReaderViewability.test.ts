// @ai-generated
// Vertical Mushaf scroll in phone landscape: the header, Continue reading
// and Play stayed on the page the reader had rotated on, however far they
// scrolled. A page there is about three screens tall, and the list was asked
// to report a page once half of the PAGE is visible, which can never happen.
//
// These run the rule the vertical views now use through the code that decides
// what each view's onViewableItemsChanged reports, with the page sizes of the
// real layout: React Native's ViewabilityHelper for the vertical Mushaf
// (ContinuousMushafView is a FlatList told where each page is), and
// FlashList's for the verse list (ContinuousListView).

import fs from 'fs';
import {VERTICAL_READER_VIEWABILITY, getMushafLayout} from '../constants';
import {buildPageOffsets, pageItemLayout} from '../skia/continuousPageOffsets';
import {buildRenderConstants} from '../skia/continuousRenderConstants';

// The render constants read three numbers from the DK text service, and the
// line height depends on none of them; its database is not needed here.
jest.mock('@/services/mushaf/QuranTextService', () => ({
  PAGE_WIDTH: 17000,
  MARGIN: 400,
  FONTSIZE: 1000,
}));

interface Layout {
  x: number;
  y: number;
  width: number;
  height: number;
}
type FlashListViewabilityHelperClass = new (
  config: object,
  viewableIndicesChanged: (indices: number[]) => void,
) => {
  updateViewableItems(
    horizontal: boolean,
    scrollOffset: number,
    listSize: {width: number; height: number},
    getLayout: (index: number) => Layout | undefined,
    viewableIndices?: number[],
  ): void;
  dispose(): void;
};

/**
 * FlashList's ViewabilityHelper as installed. The package ships ES modules,
 * which Jest does not transform under node_modules (the other suites mock
 * the list), so this one file is compiled here.
 */
function loadFlashListViewabilityHelper(): FlashListViewabilityHelperClass {
  const file = require.resolve(
    '@shopify/flash-list/dist/recyclerview/viewability/ViewabilityHelper.js',
  );
  const babel = require('@babel/core') as {
    transformSync(source: string, options: object): {code: string} | null;
  };
  const compiled = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    babelrc: false,
    configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  if (!compiled) throw new Error('ViewabilityHelper did not compile');
  const loaded: {exports: {default?: FlashListViewabilityHelperClass}} = {
    exports: {},
  };
  // Its only import is the text of an error these tests never raise.
  const requireStub = (): object => ({ErrorMessages: {}});
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', compiled.code)(
    requireStub,
    loaded,
    loaded.exports,
  );
  if (!loaded.exports.default) throw new Error('ViewabilityHelper not found');
  return loaded.exports.default;
}

const FlashListViewabilityHelper = loadFlashListViewabilityHelper();

/** A FlatList's props, as its ViewabilityHelper reads them. */
interface FlatListCellProps {
  data: number[];
  getItemCount: (data: number[]) => number;
  getItem: (data: number[], index: number) => number;
  getItemLayout: (
    data: unknown,
    index: number,
  ) => {length: number; offset: number; index: number};
  keyExtractor: (item: number) => string;
}
interface ViewToken {
  item: number;
}
type FlatListViewabilityHelperClass = new (config: object) => {
  onUpdate(
    props: FlatListCellProps,
    scrollOffset: number,
    viewportHeight: number,
    listMetrics: object,
    createViewToken: (index: number, isViewable: boolean) => object,
    onViewableItemsChanged: (info: {viewableItems: ViewToken[]}) => void,
  ): void;
  dispose(): void;
};

/**
 * React Native's ViewabilityHelper, which decides what a FlatList's
 * onViewableItemsChanged reports, and the list metrics it reads each cell's
 * place from (with getItemLayout, the cell's layout entry). Jest compiles
 * React Native's sources.
 */
const FlatListViewabilityHelper = (
  require('@react-native/virtualized-lists/Lists/ViewabilityHelper') as {
    default: FlatListViewabilityHelperClass;
  }
).default;
const ListMetricsAggregator = (
  require('@react-native/virtualized-lists/Lists/ListMetricsAggregator') as {
    default: new () => object;
  }
).default;

const OLD_RULE = {itemVisiblePercentThreshold: 50};
const LINES_PER_PAGE = 15;
const PAGE_COUNT = 6;

/**
 * Where the pages of the vertical Mushaf sit (ContinuousMushafView's
 * getItemLayout entries), from the top of page 1: each page is LINES_PER_PAGE
 * lines of the view's line height.
 */
function mushafPageOffsets(width: number, height: number): number[] {
  const metrics = getMushafLayout({width, height, isTablet: false});
  const {baseLineHeight} = buildRenderConstants(metrics);
  return buildPageOffsets(PAGE_COUNT, () => LINES_PER_PAGE, baseLineHeight, 0);
}

/**
 * Pages the vertical Mushaf's FlatList reports at a scroll offset, under
 * `config`, with its pages at `offsets`.
 */
function mushafReports(
  config: object,
  offsets: readonly number[],
  viewportHeight: number,
  scrollOffset: number,
): number[] {
  const pages = Array.from({length: offsets.length - 1}, (_, i) => i + 1);
  let reportedPages: number[] = [];
  const helper = new FlatListViewabilityHelper(config);
  helper.onUpdate(
    {
      data: pages,
      getItemCount: data => data.length,
      getItem: (data, index) => data[index],
      getItemLayout: (_, index) => pageItemLayout(offsets, index),
      keyExtractor: page => `page-${page}`,
    },
    scrollOffset,
    viewportHeight,
    new ListMetricsAggregator(),
    (index, isViewable) => ({
      index,
      item: pages[index],
      key: `page-${pages[index]}`,
      isViewable,
    }),
    ({viewableItems}) => {
      reportedPages = viewableItems.map(token => token.item);
    },
  );
  helper.dispose();
  return reportedPages;
}

/**
 * Rows (1-based) the verse list's FlashList reports at a scroll offset, under
 * `config`, with every row `itemHeight` tall.
 */
function verseListReports(
  config: object,
  itemHeight: number,
  viewportHeight: number,
  scrollOffset: number,
): number[] {
  let indices: number[] = [];
  const helper = new FlashListViewabilityHelper(config, viewable => {
    indices = viewable;
  });
  helper.updateViewableItems(
    false,
    scrollOffset,
    {width: 400, height: viewportHeight},
    index => ({x: 0, y: index * itemHeight, width: 400, height: itemHeight}),
    Array.from({length: PAGE_COUNT}, (_, i) => i),
  );
  jest.runOnlyPendingTimers();
  helper.dispose();
  return indices.map(index => index + 1);
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('phone landscape (844 x 390)', () => {
  const viewport = 390;
  const offsets = mushafPageOffsets(844, 390);
  const page = offsets[1] - offsets[0];

  it('a page is far taller than the screen', () => {
    expect(page).toBeGreaterThan(viewport * 2);
  });

  it('the old rule never reported any page', () => {
    for (let offset = 0; offset < page * 4; offset += 50) {
      expect(mushafReports(OLD_RULE, offsets, viewport, offset)).toEqual([]);
    }
  });

  it('reports the page that fills the screen, all the way down', () => {
    // Inside page 3, then inside page 4.
    expect(
      mushafReports(
        VERTICAL_READER_VIEWABILITY,
        offsets,
        viewport,
        page * 2 + 300,
      ),
    ).toEqual([3]);
    expect(
      mushafReports(
        VERTICAL_READER_VIEWABILITY,
        offsets,
        viewport,
        page * 3 + 10,
      ),
    ).toEqual([4]);
    // Never an empty report: there is always a current page.
    for (let offset = 0; offset < page * 4; offset += 50) {
      expect(
        mushafReports(VERTICAL_READER_VIEWABILITY, offsets, viewport, offset)
          .length,
      ).toBeGreaterThan(0);
    }
  });

  it('moves to the next page once it covers half of the screen', () => {
    const boundary = page * 2; // top of page 3
    expect(
      mushafReports(
        VERTICAL_READER_VIEWABILITY,
        offsets,
        viewport,
        boundary - viewport / 2 - 20,
      ),
    ).toEqual([2]);
    expect(
      mushafReports(
        VERTICAL_READER_VIEWABILITY,
        offsets,
        viewport,
        boundary - viewport / 2 + 20,
      ),
    ).toEqual([3]);
  });
});

describe('phone portrait (390 x 844)', () => {
  const viewport = 844;
  const offsets = mushafPageOffsets(390, 844);
  const page = offsets[1] - offsets[0];

  it('a page is shorter than the screen', () => {
    expect(page).toBeLessThan(viewport);
  });

  it('a page that is wholly on screen is reported, whatever its size', () => {
    expect(
      mushafReports(VERTICAL_READER_VIEWABILITY, offsets, viewport, 0)[0],
    ).toBe(1);
    expect(
      mushafReports(
        VERTICAL_READER_VIEWABILITY,
        offsets,
        viewport,
        page * 2,
      )[0],
    ).toBe(3);
    // A short verse row in the list view counts the same way.
    expect(
      verseListReports(VERTICAL_READER_VIEWABILITY, 80, viewport, 0)[0],
    ).toBe(1);
  });

  it('always reports a current page while scrolling', () => {
    for (let offset = 0; offset < page * 4; offset += 25) {
      expect(
        mushafReports(VERTICAL_READER_VIEWABILITY, offsets, viewport, offset)
          .length,
      ).toBeGreaterThan(0);
    }
  });
});

describe('a verse row taller than two screens (list view)', () => {
  it('is reported while it fills the screen; the old rule reported nothing', () => {
    const viewport = 390;
    const row = 900;
    expect(verseListReports(OLD_RULE, row, viewport, row + 200)).toEqual([]);
    expect(
      verseListReports(VERTICAL_READER_VIEWABILITY, row, viewport, row + 200),
    ).toEqual([2]);
  });
});
