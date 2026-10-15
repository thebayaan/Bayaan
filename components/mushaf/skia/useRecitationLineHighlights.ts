import {useMemo} from 'react';
import Color from 'color';
import type {DKLine} from '@/services/mushaf/DigitalKhattDataService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {useRecitationTrackingStore} from '@/store/recitationTrackingStore';
import {dkWordPosition, withRecitedWordRun} from './recitedWord';
import type {LineHighlight, LineHighlightMap} from './verseHighlightLayers';

const FIELD_SEPARATOR = '|';
const KEY_SEPARATOR = ',';

/**
 * Adds recitation follow-along to a Digital Khatt page's line highlights:
 * a faint tint under ayat already recited this take, and the word being
 * recited over its ayah's band. Pages without the recited ayah keep `base`
 * and do not re-render as the reader moves through other pages.
 */
export function useRecitationLineHighlights(
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

  // Value-comparable ids, '' when nothing of the take is on this page.
  const wordId = useRecitationTrackingStore(s =>
    s.status === 'listening' &&
    s.verseKey &&
    s.wordIndex !== null &&
    pageKeys.has(s.verseKey)
      ? [s.verseKey, s.wordIndex, s.totalWords].join(FIELD_SEPARATOR)
      : '',
  );
  const recitedId = useRecitationTrackingStore(s =>
    s.status === 'listening'
      ? s.recitedVerseKeys
          .filter(k => k !== s.verseKey && pageKeys.has(k))
          .join(KEY_SEPARATOR)
      : '',
  );

  const colors = useMemo(
    () => ({
      recited: Color(textColor)
        .alpha(isDarkMode ? 0.05 : 0.06)
        .toString(),
      word: Color(textColor)
        .alpha(isDarkMode ? 0.22 : 0.25)
        .toString(),
    }),
    [textColor, isDarkMode],
  );

  return useMemo(() => {
    if (!wordId && !recitedId) return base;
    let out = base;

    if (recitedId) {
      // Under every other layer: prepend to each line's runs.
      const below = new Map<number, LineHighlight[]>();
      for (const key of recitedId.split(KEY_SEPARATOR)) {
        for (const {
          lineIndex,
          segment,
        } of mushafVerseMapService.getVerseSegmentsForPage(pageNumber, key)) {
          const runs = below.get(lineIndex) ?? [];
          runs.push({
            start: segment.startCharIndex,
            end: segment.endCharIndex,
            color: colors.recited,
          });
          below.set(lineIndex, runs);
        }
      }
      out = new Map(out);
      for (const [lineIndex, runs] of below) {
        out.set(lineIndex, [...runs, ...(out.get(lineIndex) ?? [])]);
      }
    }

    if (wordId) {
      const [verseKey, wordIndex, totalWords] = wordId.split(FIELD_SEPARATOR);
      const position = dkWordPosition(
        digitalKhattDataService.getVerseWords(verseKey),
        Number(wordIndex),
        Number(totalWords),
      );
      if (position !== null) {
        out = withRecitedWordRun(
          out,
          pageLines,
          digitalKhattDataService,
          verseKey,
          position,
          colors.word,
        );
      }
    }
    return out;
  }, [wordId, recitedId, base, pageNumber, pageLines, colors]);
}
