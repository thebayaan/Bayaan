import {useMemo, useRef} from 'react';
import type {DKLine} from '@/services/mushaf/DigitalKhattDataService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {getLineWordSpans} from '@/services/mushaf/lineWordSpans';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useRecitationTrackingStore} from '@/store/recitationTrackingStore';
import {isRevealed} from '@/services/recitation/reveal';

type LineColorMap = Map<number, string> | null;

// Hidden words are drawn fully transparent: same glyphs, so the layout and
// the ayah markers stay put.
const HIDDEN = 'rgba(0,0,0,0)';

/**
 * Hide and reveal for a Digital Khatt page: while the reader's recitation is
 * followed with "hide text" on, every word after the revealed point is
 * invisible, through SkiaLine's per-character colours. `base` (e.g. the
 * Allah-name colours) shows through on revealed words. Lines whose hidden set
 * did not change keep their map, so only the line being recited rebuilds its
 * paragraph.
 */
export function useRecitationHiddenText(
  pageLines: readonly DKLine[],
  base: readonly LineColorMap[] | null,
): readonly LineColorMap[] | null {
  const hideText = useMushafSettingsStore(s => s.recitationHideText);
  // Comparable id of the revealed point; null when not hiding.
  const revealedId = useRecitationTrackingStore(s => {
    if (!hideText || s.status !== 'listening') return null;
    const t = s.revealedThrough;
    return t ? `${t.surah}:${t.ayah}:${t.position}` : '';
  });
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
    const through = useRecitationTrackingStore.getState().revealedThrough;
    const out: LineColorMap[] = [];
    for (let lineIndex = 0; lineIndex < pageLines.length; lineIndex++) {
      const baseMap = base?.[lineIndex] ?? null;
      const hidden: Array<[number, number]> = [];
      for (const span of getLineWordSpans(
        pageLines[lineIndex],
        digitalKhattDataService,
      )) {
        if (span.wordEnd < span.start) continue;
        const [surah, ayah] = span.info.verseKey.split(':').map(Number);
        if (!isRevealed(through, surah, ayah, span.info.wordPositionInVerse)) {
          hidden.push([span.start, span.wordEnd]);
        }
      }
      const sig = hidden.map(h => h.join('-')).join(',');
      const cached = cache.current.get(lineIndex);
      if (cached && cached.sig === sig) {
        out.push(cached.map);
        continue;
      }
      let map: LineColorMap = baseMap;
      if (hidden.length > 0) {
        map = new Map(baseMap ?? []);
        for (const [start, end] of hidden) {
          for (let i = start; i <= end; i++) map.set(i, HIDDEN);
        }
      }
      cache.current.set(lineIndex, {sig, map});
      out.push(map);
    }
    return out;
  }, [revealedId, base, pageLines]);
}
