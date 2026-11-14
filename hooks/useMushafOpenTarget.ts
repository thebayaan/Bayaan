// @ai-generated
// Where the reader opens (RFC-023 step 1). The data loads after the splash, so
// the page of a verse is known only when it is ready, and after the rewayah of
// a saved verse is restored. It is worked out once and kept: a rewayah switch
// in the reader later moves no page and flashes no verse again.
import {useEffect, useState} from 'react';
import {useMushafData} from '@/hooks/useMushafData';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {isRewayahId} from '@/services/rewayah/RewayahIdentity';
import {restoreSavedRewayah} from '@/services/verse-annotations/restoreSavedRewayah';

/** The /mushaf params that say where it opens (see MushafScreenParams). */
export type MushafOpenParams = {
  surah?: string;
  page?: string;
  ayah?: string;
  anchor?: string;
  rewayah?: string;
};

export type MushafOpenTarget = {
  page: number;
  /**
   * The surah asked for, when the page comes from it. A page can hold the end
   * of one surah and the start of another (or three, on 601-604), so the page
   * alone cannot name the surah for the header.
   */
  surahId?: number;
  /** The verse to flash: the surah and ayah params. */
  verseKey?: string;
  /** A stored Hafs anchor to flash instead (MushafScreenParams.anchor). */
  anchor?: string;
};

export type MushafOpenState =
  | {state: 'loading'}
  | {state: 'failed'; retry: () => void}
  | {state: 'ready'; target: MushafOpenTarget};

function resolveTarget(params: MushafOpenParams): MushafOpenTarget {
  const {surah, page, ayah, anchor} = params;
  const verseKey = surah && ayah ? `${surah}:${ayah}` : undefined;
  const p = page ? parseInt(page, 10) : NaN;
  if (p >= 1 && p <= 604) return {page: p, verseKey, anchor};
  const dk = digitalKhattDataService;
  const s = surah ? parseInt(surah, 10) : NaN;
  const surahStart = dk.getSurahStartPages()[s];
  const surahId = !page && surahStart ? s : undefined;
  // A verse with no page: the page of the verse, in the restored rewayah.
  const versePage =
    surah && ayah ? dk.getPageForVerse(`${s}:${parseInt(ayah, 10)}`) : 0;
  return {page: versePage || surahStart || 1, surahId, verseKey, anchor};
}

export function useMushafOpenTarget(params: MushafOpenParams): MushafOpenState {
  const data = useMushafData();
  // A saved verse brings its rewayah: restore it before the page is looked up,
  // so no page of another rewayah shows meanwhile.
  const savedRewayah = isRewayahId(params.rewayah) ? params.rewayah : undefined;
  const [restored, setRestored] = useState(!savedRewayah);
  useEffect(() => {
    if (restored || data.state !== 'ready') return;
    let cancelled = false;
    restoreSavedRewayah(savedRewayah).finally(() => {
      if (!cancelled) setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, [restored, data.state, savedRewayah]);

  // Worked out in the first render that can, then kept.
  const [target, setTarget] = useState<MushafOpenTarget | null>(null);
  if (!target && restored && data.state === 'ready') {
    setTarget(resolveTarget(params));
  }

  if (data.state === 'failed') return {state: 'failed', retry: data.retry};
  if (data.state === 'ready' && target) return {state: 'ready', target};
  return {state: 'loading'};
}
