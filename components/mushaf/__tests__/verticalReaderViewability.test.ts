// @ai-generated
// Vertical Mushaf scroll in phone landscape: the header, Continue reading
// and Play stayed on the page the reader had rotated on, however far they
// scrolled. A page there is about three screens tall, and the list was asked
// to report a page once half of the PAGE is visible, which can never happen.
//
// These run the rule the vertical views now use through FlashList's own
// ViewabilityHelper (the code that decides what onViewableItemsChanged
// reports), with the page sizes of the real layout.

import fs from 'fs';
import {VERTICAL_READER_VIEWABILITY, getMushafLayout} from '../constants';

interface Layout {
  x: number;
  y: number;
  width: number;
  height: number;
}
type ViewabilityHelperClass = new (
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
function loadViewabilityHelper(): ViewabilityHelperClass {
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
  const loaded: {exports: {default?: ViewabilityHelperClass}} = {exports: {}};
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

const ViewabilityHelper = loadViewabilityHelper();

const OLD_RULE = {itemVisiblePercentThreshold: 50};
const LINES_PER_PAGE = 15;
const PAGE_COUNT = 6;

/** Height of a page in the vertical mushaf (ContinuousMushafView). */
function pageHeight(width: number, height: number): number {
  const metrics = getMushafLayout({width, height, isTablet: false});
  return (
    Math.min(metrics.baseLineHeight, metrics.contentWidth * 0.1) *
    LINES_PER_PAGE
  );
}

/** Pages (1-based) the list reports at a scroll offset, under `config`. */
function reported(
  config: object,
  itemHeight: number,
  viewportHeight: number,
  scrollOffset: number,
): number[] {
  let indices: number[] = [];
  const helper = new ViewabilityHelper(config, viewable => {
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
  const page = pageHeight(844, 390);

  it('a page is far taller than the screen', () => {
    expect(page).toBeGreaterThan(viewport * 2);
  });

  it('the old rule never reported any page', () => {
    for (let offset = 0; offset < page * 4; offset += 50) {
      expect(reported(OLD_RULE, page, viewport, offset)).toEqual([]);
    }
  });

  it('reports the page that fills the screen, all the way down', () => {
    // Inside page 3, then inside page 4.
    expect(
      reported(VERTICAL_READER_VIEWABILITY, page, viewport, page * 2 + 300),
    ).toEqual([3]);
    expect(
      reported(VERTICAL_READER_VIEWABILITY, page, viewport, page * 3 + 10),
    ).toEqual([4]);
    // Never an empty report: there is always a current page.
    for (let offset = 0; offset < page * 4; offset += 50) {
      expect(
        reported(VERTICAL_READER_VIEWABILITY, page, viewport, offset).length,
      ).toBeGreaterThan(0);
    }
  });

  it('moves to the next page once it covers half of the screen', () => {
    const boundary = page * 2; // top of page 3
    expect(
      reported(
        VERTICAL_READER_VIEWABILITY,
        page,
        viewport,
        boundary - viewport / 2 - 20,
      ),
    ).toEqual([2]);
    expect(
      reported(
        VERTICAL_READER_VIEWABILITY,
        page,
        viewport,
        boundary - viewport / 2 + 20,
      ),
    ).toEqual([3]);
  });
});

describe('phone portrait (390 x 844)', () => {
  const viewport = 844;
  const page = pageHeight(390, 844);

  it('a page is shorter than the screen', () => {
    expect(page).toBeLessThan(viewport);
  });

  it('a page that is wholly on screen is reported, whatever its size', () => {
    expect(reported(VERTICAL_READER_VIEWABILITY, page, viewport, 0)[0]).toBe(1);
    expect(
      reported(VERTICAL_READER_VIEWABILITY, page, viewport, page * 2)[0],
    ).toBe(3);
    // A short verse row in the list view counts the same way.
    expect(reported(VERTICAL_READER_VIEWABILITY, 80, viewport, 0)[0]).toBe(1);
  });

  it('always reports a current page while scrolling', () => {
    for (let offset = 0; offset < page * 4; offset += 25) {
      expect(
        reported(VERTICAL_READER_VIEWABILITY, page, viewport, offset).length,
      ).toBeGreaterThan(0);
    }
  });
});

describe('a verse row taller than two screens (list view)', () => {
  it('is reported while it fills the screen; the old rule reported nothing', () => {
    const viewport = 390;
    const row = 900;
    expect(reported(OLD_RULE, row, viewport, row + 200)).toEqual([]);
    expect(
      reported(VERTICAL_READER_VIEWABILITY, row, viewport, row + 200),
    ).toEqual([2]);
  });
});
