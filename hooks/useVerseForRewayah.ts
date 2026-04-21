import {useMemo, useEffect, useReducer} from 'react';
import {
  digitalKhattDataService,
  type DKWordInfo,
} from '@/services/mushaf/DigitalKhattDataService';
import {
  useMushafSettingsStore,
  type RewayahId,
} from '@/store/mushafSettingsStore';

// Returns the words/text for a verse in the app's currently-active mushaf
// rewayah. Re-renders when the user switches rewayat in settings.
export function useMushafVerseWords(verseKey: string | null): DKWordInfo[] {
  const rewayah = useMushafSettingsStore(s => s.rewayah);
  return useMemo(() => {
    if (!verseKey) return EMPTY_WORDS;
    return digitalKhattDataService.getVerseWords(verseKey);
    // rewayah dep forces re-read after switchRewayah repopulates the main cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verseKey, rewayah]);
}

export function useMushafVerseText(verseKey: string | null): string {
  const rewayah = useMushafSettingsStore(s => s.rewayah);
  return useMemo(() => {
    if (!verseKey) return '';
    return digitalKhattDataService.getVerseText(verseKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verseKey, rewayah]);
}

// Returns words/text for a verse in an *arbitrary* rewayah, independent of
// the mushaf setting. Used by the player to render text that matches the
// currently-playing reciter's rewayah. Triggers a lazy DB load on first use
// for each non-active rewayah and re-renders when it completes.
export function useVerseWordsInRewayah(
  verseKey: string | null,
  rewayah: RewayahId,
): DKWordInfo[] {
  const [, bump] = useReducer(x => x + 1, 0);
  useEffect(() => {
    if (rewayah === digitalKhattDataService.rewayah) return;
    let cancelled = false;
    digitalKhattDataService.ensureRewayahLoaded(rewayah).then(() => {
      if (!cancelled) bump();
    });
    return () => {
      cancelled = true;
    };
  }, [rewayah]);
  // Also re-render when the active rewayah changes (side cache may evict).
  const activeRewayah = useMushafSettingsStore(s => s.rewayah);
  return useMemo(() => {
    if (!verseKey) return EMPTY_WORDS;
    return digitalKhattDataService.getVerseWords(verseKey, rewayah);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verseKey, rewayah, activeRewayah]);
}

export function useVerseTextInRewayah(
  verseKey: string | null,
  rewayah: RewayahId,
): string {
  const words = useVerseWordsInRewayah(verseKey, rewayah);
  return useMemo(() => words.map(w => w.text).join(' '), [words]);
}

const EMPTY_WORDS: DKWordInfo[] = [];
