// @ai-generated
import {useMemo} from 'react';
import Color from 'color';
import type {DKLine} from '@/services/mushaf/DigitalKhattDataService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {useMushafWordFlashStore} from '@/store/mushafWordFlashStore';
import {withRecitedWordRun} from './recitedWord';
import type {LineHighlightMap} from './verseHighlightLayers';

const FIELD_SEPARATOR = '|';
const POSITION_SEPARATOR = ',';

/**
 * Adds the word flash (the words a Quran search matched) to a Digital Khatt
 * page's line highlights, as a band in the colour of the word being
 * recited. Pages without the flashed verse keep `base` and do not re-render
 * when a flash starts or ends elsewhere. Positions are Hafs slots, which
 * every rewayah's text keeps; a blank slot paints nothing.
 */
export function useWordFlashHighlights(
  pageNumber: number,
  pageLines: readonly DKLine[],
  base: LineHighlightMap,
  textColor: string,
  isDarkMode: boolean,
): LineHighlightMap {
  const pageKeys = useMemo(
    () => new Set(mushafVerseMapService.getOrderedVerseKeysForPage(pageNumber)),
    // pageLines: re-read after a data reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageNumber, pageLines],
  );

  // A value-comparable id, '' when the flashed verse is not on this page.
  const flashId = useMushafWordFlashStore(s =>
    s.flash && pageKeys.has(s.flash.verseKey)
      ? [
          s.flash.id,
          s.flash.verseKey,
          s.flash.positions.join(POSITION_SEPARATOR),
        ].join(FIELD_SEPARATOR)
      : '',
  );

  const color = useMemo(
    () =>
      Color(textColor)
        .alpha(isDarkMode ? 0.22 : 0.25)
        .toString(),
    [textColor, isDarkMode],
  );

  return useMemo(() => {
    if (!flashId) return base;
    const [, verseKey, positions] = flashId.split(FIELD_SEPARATOR);
    let out = base;
    for (const position of positions.split(POSITION_SEPARATOR)) {
      out = withRecitedWordRun(
        out,
        pageLines,
        digitalKhattDataService,
        verseKey,
        Number(position),
        color,
        'band',
      );
    }
    return out;
  }, [flashId, base, pageLines, color]);
}
