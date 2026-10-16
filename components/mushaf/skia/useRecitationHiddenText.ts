import {useMemo, useRef} from 'react';
import Color from 'color';
import type {DKLine} from '@/services/mushaf/DigitalKhattDataService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {getLineWordSpans} from '@/services/mushaf/lineWordSpans';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useRecitationTrackingStore} from '@/store/recitationTrackingStore';
import type {RevealedWords} from '@/services/recitation/reveal';
import {dkWordPosition} from './recitedWord';

type LineColorMap = Map<number, string> | null;

/** Last DK word position revealed for an ayah: 0 none, Infinity all. */
function revealedPosition(revealed: RevealedWords, verseKey: string): number {
  const ayah = revealed[verseKey];
  if (!ayah || ayah.count <= 0) return 0;
  if (ayah.count >= ayah.total) return Number.POSITIVE_INFINITY;
  return (
    dkWordPosition(
      digitalKhattDataService.getVerseWords(verseKey),
      ayah.count - 1,
      ayah.total,
    ) ?? 0
  );
}

/**
 * Hide and reveal for a Digital Khatt page: while the reader's recitation is
 * followed with "hide text" on, words not yet recited are drawn as faint
 * ghosts (same glyphs, so layout and ayah markers stay put) through SkiaLine's
 * per-character colours. `base` (e.g. the Allah-name colours) shows through
 * on revealed words. Lines whose hidden set did not change keep their map, so
 * only the line being recited rebuilds its paragraph.
 */
export function useRecitationHiddenText(
  pageNumber: number,
  pageLines: readonly DKLine[],
  base: readonly LineColorMap[] | null,
  textColor: string,
  isDarkMode: boolean,
): readonly LineColorMap[] | null {
  const pageKeys = useMemo(
    () => mushafVerseMapService.getOrderedVerseKeysForPage(pageNumber),
    // pageLines: re-read after a data reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageNumber, pageLines],
  );
  const hideText = useMushafSettingsStore(s => s.recitationHideText);
  // Comparable id of what is revealed on this page; null when not hiding.
  const revealedId = useRecitationTrackingStore(s => {
    if (!hideText || s.status !== 'listening') return null;
    return pageKeys
      .map(k => {
        const ayah = s.revealed[k];
        return ayah ? `${k}=${ayah.count}/${ayah.total}` : '';
      })
      .join(',');
  });
  const ghost = useMemo(
    () =>
      Color(textColor)
        .alpha(isDarkMode ? 0.1 : 0.08)
        .toString(),
    [textColor, isDarkMode],
  );
  const cache = useRef(new Map<number, {sig: string; map: LineColorMap}>());
  const cachedBase = useRef(base);

  return useMemo(() => {
    if (revealedId === null) {
      cache.current.clear();
      return base;
    }
    if (cachedBase.current !== base) {
      cache.current.clear();
      cachedBase.current = base;
    }
    const revealed = useRecitationTrackingStore.getState().revealed;
    const positions = new Map<string, number>();
    const out: LineColorMap[] = [];
    for (let lineIndex = 0; lineIndex < pageLines.length; lineIndex++) {
      const baseMap = base?.[lineIndex] ?? null;
      const hidden: Array<[number, number]> = [];
      for (const span of getLineWordSpans(
        pageLines[lineIndex],
        digitalKhattDataService,
      )) {
        if (span.wordEnd < span.start) continue;
        const key = span.info.verseKey;
        let position = positions.get(key);
        if (position === undefined) {
          position = revealedPosition(revealed, key);
          positions.set(key, position);
        }
        if (span.info.wordPositionInVerse > position) {
          hidden.push([span.start, span.wordEnd]);
        }
      }
      const sig = `${ghost}|${hidden.map(h => h.join('-')).join(',')}`;
      const cached = cache.current.get(lineIndex);
      if (cached && cached.sig === sig) {
        out.push(cached.map);
        continue;
      }
      let map: LineColorMap = baseMap;
      if (hidden.length > 0) {
        map = new Map(baseMap ?? []);
        for (const [start, end] of hidden) {
          for (let i = start; i <= end; i++) map.set(i, ghost);
        }
      }
      cache.current.set(lineIndex, {sig, map});
      out.push(map);
    }
    return out;
  }, [revealedId, base, pageLines, ghost]);
}
