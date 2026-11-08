import {useMemo} from 'react';
import Color from 'color';
import type {DKLine} from '@/services/mushaf/DigitalKhattDataService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {
  isTakeActive,
  useRecitationTrackingStore,
} from '@/store/recitationTrackingStore';
import {dkWordPosition, withRecitedWordRun} from './recitedWord';
import {mistakeColor} from './useRecitationMarkColors';
import type {LineHighlight, LineHighlightMap} from './verseHighlightLayers';

const FIELD_SEPARATOR = '|';
const KEY_SEPARATOR = ',';

/**
 * Adds recitation follow-along to a Digital Khatt page's line highlights:
 * a faint tint under ayat already recited this take, the word being recited,
 * a dotted underline under each word marked as a mistake (and kept once it
 * is corrected), a small caret in the gap before the word an added mark stands
 * on, and a light band over a skipped or look-alike ayah. Pages
 * without any of it keep `base` and do not re-render as the reader moves
 * through other pages. Mistake letters are coloured by
 * useRecitationMarkColors.
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
    isTakeActive(s.status) &&
    s.verseKey &&
    s.wordIndex !== null &&
    pageKeys.has(s.verseKey)
      ? [s.verseKey, s.wordIndex, s.totalWords].join(FIELD_SEPARATOR)
      : '',
  );
  const recitedId = useRecitationTrackingStore(s =>
    isTakeActive(s.status)
      ? s.recitedVerseKeys
          .filter(k => k !== s.verseKey && pageKeys.has(k))
          .join(KEY_SEPARATOR)
      : '',
  );

  // Memorisation: possible slips on this page, as kind|key|word|total.
  const flagsId = useRecitationTrackingStore(s =>
    isTakeActive(s.status)
      ? s.flags
          .filter(f => pageKeys.has(`${f.surah}:${f.ayah}`))
          .map(f =>
            [f.kind, `${f.surah}:${f.ayah}`, f.word, f.totalWords ?? 0].join(
              FIELD_SEPARATOR,
            ),
          )
          .join(KEY_SEPARATOR)
      : '',
  );

  // Word marks on this page, as key|word|total|kind. They stay after the take
  // ends, until the next one.
  const marksId = useRecitationTrackingStore(s =>
    s.marks
      .filter(m => pageKeys.has(`${m.surah}:${m.ayah}`))
      .map(m =>
        [`${m.surah}:${m.ayah}`, m.word, m.totalWords, m.kind].join(
          FIELD_SEPARATOR,
        ),
      )
      .join(KEY_SEPARATOR),
  );

  const colors = useMemo(
    () => ({
      mistake: mistakeColor(isDarkMode),
      ayahFlag: Color(mistakeColor(isDarkMode))
        .alpha(isDarkMode ? 0.22 : 0.14)
        .toString(),
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
    if (!wordId && !recitedId && !flagsId && !marksId) return base;
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

    if (flagsId) {
      for (const entry of flagsId.split(KEY_SEPARATOR)) {
        const [kind, verseKey, word, total] = entry.split(FIELD_SEPARATOR);
        const words = digitalKhattDataService.getVerseWords(verseKey);
        if (kind === 'skippedAyah' || kind === 'similarAyah') {
          // The whole ayah: its band on every line it spans.
          const above = new Map(out);
          for (const {
            lineIndex,
            segment,
          } of mushafVerseMapService.getVerseSegmentsForPage(
            pageNumber,
            verseKey,
          )) {
            above.set(lineIndex, [
              ...(above.get(lineIndex) ?? []),
              {
                start: segment.startCharIndex,
                end: segment.endCharIndex,
                color: colors.ayahFlag,
              },
            ]);
          }
          out = above;
          continue;
        }
        const position = dkWordPosition(
          words,
          Number(word),
          Number(total) || words.length,
        );
        if (position !== null) {
          out = withRecitedWordRun(
            out,
            pageLines,
            digitalKhattDataService,
            verseKey,
            position,
            colors.mistake,
            'underline',
          );
        }
      }
    }

    if (marksId) {
      for (const entry of marksId.split(KEY_SEPARATOR)) {
        const [verseKey, word, total, kind] = entry.split(FIELD_SEPARATOR);
        const position = dkWordPosition(
          digitalKhattDataService.getVerseWords(verseKey),
          Number(word),
          Number(total),
        );
        if (position === null) continue;
        out = withRecitedWordRun(
          out,
          pageLines,
          digitalKhattDataService,
          verseKey,
          position,
          colors.mistake,
          kind === 'added' ? 'caret' : 'underline',
        );
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
  }, [
    wordId,
    recitedId,
    flagsId,
    marksId,
    base,
    pageNumber,
    pageLines,
    colors,
  ]);
}
