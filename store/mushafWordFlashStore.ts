// @ai-generated
/**
 * Words of one Hafs verse the mushaf flashes for a moment: the words a Quran
 * search matched, when the reader opens there. Digital Khatt pages paint
 * them (components/mushaf/skia/useWordFlashHighlights.ts); positions are
 * Hafs slots, which every rewayah's words keep.
 */
import {create} from 'zustand';

export interface WordFlash {
  /** Hafs verse key, 'S:A'. */
  verseKey: string;
  /** Digital Khatt slots of that verse. */
  positions: readonly number[];
  /** Changes with every flash, so the same words can flash again. */
  id: number;
}

interface MushafWordFlashState {
  flash: WordFlash | null;
  /** Flashes the words for `ms` (default 3000, like the verse flash). */
  show: (verseKey: string, positions: readonly number[], ms?: number) => void;
  clear: () => void;
}

export const WORD_FLASH_MS = 3000;

let timer: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;

function stopTimer(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

export const useMushafWordFlashStore = create<MushafWordFlashState>()(set => ({
  flash: null,
  show: (verseKey, positions, ms = WORD_FLASH_MS) => {
    stopTimer();
    if (!positions.length) {
      set({flash: null});
      return;
    }
    set({flash: {verseKey, positions: [...positions], id: nextId++}});
    timer = setTimeout(() => {
      timer = null;
      set({flash: null});
    }, ms);
  },
  clear: () => {
    stopTimer();
    set({flash: null});
  },
}));
