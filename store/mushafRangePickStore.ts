// @ai-generated
/**
 * The Mushaf Listen sheet's last Custom range, kept for the session so
 * "Custom" comes back to it instead of the page.
 */

import {create} from 'zustand';
import type {VerseRange} from '@/utils/playbackRangeSelection';

interface MushafRangePickState {
  /** The last Custom range played this session, and its numbering. */
  lastCustom: {range: VerseRange; numbering: string} | null;
  setLastCustom: (range: VerseRange, numbering: string) => void;
}

export const useMushafRangePickStore = create<MushafRangePickState>(set => ({
  lastCustom: null,
  setLastCustom: (range, numbering) => set({lastCustom: {range, numbering}}),
}));
