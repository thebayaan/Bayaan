import {useMemo, useRef} from 'react';
import type {DKLine} from '@/services/mushaf/DigitalKhattDataService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {getLineWordSpans} from '@/services/mushaf/lineWordSpans';
import {useRecitationTrackingStore} from '@/store/recitationTrackingStore';
import {dkWordPosition} from './recitedWord';

type LineColorMap = Map<number, string> | null;

const FIELD_SEPARATOR = '|';
const KEY_SEPARATOR = ',';

/** The colour of a word marked as a mistake while reciting. */
export function mistakeColor(isDarkMode: boolean): string {
  return isDarkMode ? '#FF6B6B' : '#D32F2F';
}

/**
 * Live mistakes on a Digital Khatt page: the letters of each word marked as
 * a mistake are drawn in the mistake colour, through SkiaLine's per-character
 * colours, during the take and after it until the next one. Applied over
 * `base` (hidden text, Allah-name colours), so a missed word shows even while
 * the text is hidden. Lines without a mistake keep their map. An added mark
 * colours no letters: both words around it were read correctly.
 */
export function useRecitationMarkColors(
  pageLines: readonly DKLine[],
  base: readonly LineColorMap[] | null,
  isDarkMode: boolean,
): readonly LineColorMap[] | null {
  // Comparable id of the mistakes; '' when there are none. Marks stay after
  // the take ends, until the next one.
  const mistakesId = useRecitationTrackingStore(s =>
    s.marks
      .filter(m => m.status === 'mistake' && m.kind !== 'added')
      .map(m =>
        [`${m.surah}:${m.ayah}`, m.word, m.totalWords].join(FIELD_SEPARATOR),
      )
      .join(KEY_SEPARATOR),
  );
  const cache = useRef(new Map<number, {sig: string; map: LineColorMap}>());
  const cachedBase = useRef(base);

  return useMemo(() => {
    if (!mistakesId) {
      cache.current.clear();
      return base;
    }
    if (cachedBase.current !== base) {
      cache.current.clear();
      cachedBase.current = base;
    }
    // Digital Khatt word positions to colour, per verse.
    const wanted = new Map<string, Set<number>>();
    for (const entry of mistakesId.split(KEY_SEPARATOR)) {
      const [verseKey, word, total] = entry.split(FIELD_SEPARATOR);
      const position = dkWordPosition(
        digitalKhattDataService.getVerseWords(verseKey),
        Number(word),
        Number(total),
      );
      if (position === null) continue;
      const set = wanted.get(verseKey) ?? new Set<number>();
      set.add(position);
      wanted.set(verseKey, set);
    }
    const color = mistakeColor(isDarkMode);
    const out: LineColorMap[] = [];
    for (let lineIndex = 0; lineIndex < pageLines.length; lineIndex++) {
      const baseMap = base?.[lineIndex] ?? null;
      const spans = getLineWordSpans(
        pageLines[lineIndex],
        digitalKhattDataService,
      ).filter(
        span =>
          span.wordEnd >= span.start &&
          wanted.get(span.info.verseKey)?.has(span.info.wordPositionInVerse),
      );
      if (spans.length === 0) {
        out.push(baseMap);
        continue;
      }
      const sig =
        color + spans.map(span => `${span.start}-${span.wordEnd}`).join(',');
      const cached = cache.current.get(lineIndex);
      if (cached && cached.sig === sig) {
        out.push(cached.map);
        continue;
      }
      const map: Map<number, string> = new Map(baseMap ?? []);
      for (const span of spans) {
        for (let i = span.start; i <= span.wordEnd; i++) map.set(i, color);
      }
      cache.current.set(lineIndex, {sig, map});
      out.push(map);
    }
    return out;
  }, [mistakesId, base, pageLines, isDarkMode]);
}
