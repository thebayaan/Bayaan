// @ai-generated
/**
 * The vertical Mushaf view tells its list where each page is
 * (continuousPageOffsets): a page is its line count times the line height, so
 * page N starts after pages 1 to N - 1, with no estimate.
 */
import {buildPageOffsets, pageItemLayout} from '../continuousPageOffsets';
import {qcfDataService} from '@/services/mushaf/QCFDataService';

const LINE_HEIGHT = 42.4; // the iPhone 17 Pro Max line height
const CONTENT_TOP = 146.35; // its list padding above page 1

describe('continuousPageOffsets', () => {
  it("puts page 233 after the sum of pages 1 to 232 (Mushaf 1440's lines)", () => {
    const lineCountOf = (page: number) => qcfDataService.getLineCount(page);
    const offsets = buildPageOffsets(
      604,
      lineCountOf,
      LINE_HEIGHT,
      CONTENT_TOP,
    );

    let sum = 0;
    for (let page = 1; page <= 232; page++) {
      sum += lineCountOf(page) * LINE_HEIGHT;
    }
    const layout = pageItemLayout(offsets, 232);
    expect(layout.index).toBe(232);
    expect(layout.offset).toBeCloseTo(CONTENT_TOP + sum, 6);
    expect(layout.length).toBeCloseTo(lineCountOf(233) * LINE_HEIGHT, 6);
  });

  it('gives each page its own line count, so short pages are not estimated', () => {
    const lines = (page: number) => (page <= 2 ? 8 : 15);
    const offsets = buildPageOffsets(604, lines, LINE_HEIGHT, 0);

    expect(pageItemLayout(offsets, 0)).toEqual({
      index: 0,
      offset: 0,
      length: 8 * LINE_HEIGHT,
    });
    expect(pageItemLayout(offsets, 2).offset).toBeCloseTo(16 * LINE_HEIGHT, 6);
    expect(pageItemLayout(offsets, 603).offset).toBeCloseTo(
      (16 + 601 * 15) * LINE_HEIGHT,
      6,
    );
    expect(offsets).toHaveLength(605);
  });

  it('counts the lines of a Mushaf 1440 page without building it', () => {
    for (const page of [1, 2, 3, 233, 604]) {
      expect(qcfDataService.getLineCount(page)).toBe(
        qcfDataService.getPage(page).lines.length,
      );
    }
    expect(qcfDataService.getLineCount(0)).toBe(0);
    expect(qcfDataService.getLineCount(605)).toBe(0);
  });
});
