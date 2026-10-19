import {useEffect, useState} from 'react';
import {DEFAULT_TRANSLATION, fetchTranslation} from '../services/verseData';

/** Saheeh's first verse of Al-Mulk, bundled, so the default never shows blank. */
export const PREVIEW_FALLBACK =
  'Blessed is He in whose hand is dominion, and He is over all things competent.';
/** Said in place of a translation that can't load. */
export const PREVIEW_OFFLINE = 'This translation needs a connection';

/** One preview verse's translation, and which edition it belongs to. */
export type PreviewTranslationState = {
  edition: string;
  text: string | null;
  failed: boolean;
};

/**
 * What a preview shows under the verse. While another edition loads, the
 * last one loaded stays (no blank line between choices); a translation that
 * can't load says so, except Saheeh, whose first verse is bundled.
 */
export function previewTranslationLine(
  state: PreviewTranslationState,
  edition: string,
): string {
  const bundled = edition === DEFAULT_TRANSLATION ? PREVIEW_FALLBACK : '';
  if (state.edition === edition) {
    if (state.text) return state.text;
    if (state.failed) return bundled || PREVIEW_OFFLINE;
    return bundled;
  }
  // Another edition is loading: keep the one on screen until it lands.
  return state.text ?? bundled;
}

/**
 * The translation of one verse for Settings' preview and onboarding's
 * cards (see previewTranslationLine).
 */
export function usePreviewTranslation(
  surahNumber: number,
  verse: number,
  edition: string,
): {line: string; offline: boolean} {
  const [state, setState] = useState<PreviewTranslationState>({
    edition,
    text: null,
    failed: false,
  });

  useEffect(() => {
    let cancelled = false;
    fetchTranslation(edition, surahNumber)
      .then(verses => {
        if (cancelled) return;
        const text = verses[verse - 1] ?? null;
        setState({edition, text, failed: text === null});
      })
      .catch(() => {
        if (!cancelled) setState({edition, text: null, failed: true});
      });
    return () => {
      cancelled = true;
    };
  }, [surahNumber, verse, edition]);

  const line = previewTranslationLine(state, edition);
  return {line, offline: line === PREVIEW_OFFLINE};
}
