// @ai-generated
/**
 * Line widths of the short lines on the last pages: each entry must name the
 * line the layout centres. 600:10 (`وَمَآ أَدْرَىٰكَ مَا هِيَهْ`) is the centred
 * line of page 600; the entry used to name 600:9, a full line.
 */

jest.mock('../DigitalKhattDataService', () => {
  const line = (line_number: number, is_centered: 0 | 1) => ({
    page_number: 600,
    line_number,
    line_type: 'ayah',
    is_centered,
    first_word_id: 1,
    last_word_id: 2,
    surah_number: 101,
  });
  const lines = Array.from({length: 15}, (_, i) =>
    line(i + 1, i + 1 === 10 ? 1 : 0),
  );
  return {
    digitalKhattDataService: {getPageLines: () => lines},
  };
});

import {quranTextService} from '../QuranTextService';

describe('QuranTextService line widths', () => {
  it('narrows the line page 600 centres, not the full line before it', () => {
    // getLineInfo takes a 0-based line index.
    expect(quranTextService.getLineInfo(600, 9)).toMatchObject({
      lineWidthRatio: 0.84,
      isCentered: true,
    });
    expect(quranTextService.getLineInfo(600, 8)).toMatchObject({
      lineWidthRatio: 1,
      isCentered: false,
    });
  });
});
