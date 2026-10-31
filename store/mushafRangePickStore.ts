// @ai-generated
/**
 * "Pick on the page" for the Mushaf Listen sheet: the sheet steps aside and
 * the reader long-presses (or drags across) verses on the mushaf. The first
 * pick sets the range, a second pick sets its end. While a pick is active,
 * showVerseActions hands the selection to `consumer` (RangePickBar) instead
 * of opening the verse actions sheet.
 */

import {create} from 'zustand';
import type {VerseRange} from '@/utils/playbackRangeSelection';

/** The Listen sheet's settings, kept while the sheet is closed. */
export interface ListenDraft {
  rewayatId: string | null;
  reciterName: string | null;
  verseRepeat: number;
  rangeRepeat: number;
}

/** What showVerseActions was given for the long-pressed verses. */
export interface PickedVerses {
  verseKey: string;
  verseKeys?: string[];
  rewayah?: string;
  unitKeys?: string[];
}

interface MushafRangePickState {
  active: boolean;
  /** The page the Listen sheet was opened for. */
  page: number;
  range: VerseRange | null;
  /** The next pick sets the start ('first') or the end ('last'). */
  step: 'first' | 'last';
  draft: ListenDraft | null;
  consumer: ((picked: PickedVerses) => void) | null;
  /** The last Custom range played this session, and its numbering. */
  lastCustom: {range: VerseRange; numbering: string} | null;
  setLastCustom: (range: VerseRange, numbering: string) => void;
  start: (page: number, draft: ListenDraft, range: VerseRange | null) => void;
  setRange: (range: VerseRange, step: 'first' | 'last') => void;
  setConsumer: (consumer: ((picked: PickedVerses) => void) | null) => void;
  redo: () => void;
  end: () => void;
}

export const useMushafRangePickStore = create<MushafRangePickState>(set => ({
  active: false,
  page: 1,
  range: null,
  step: 'first',
  draft: null,
  consumer: null,
  lastCustom: null,
  setLastCustom: (range, numbering) => set({lastCustom: {range, numbering}}),
  start: (page, draft, range) =>
    set({active: true, page, draft, range, step: 'first'}),
  setRange: (range, step) => set({range, step}),
  setConsumer: consumer => set({consumer}),
  redo: () => set({range: null, step: 'first'}),
  end: () =>
    set({
      active: false,
      range: null,
      step: 'first',
      draft: null,
      consumer: null,
    }),
}));
