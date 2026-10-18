import {create} from 'zustand';

/** Where a surah menu was opened from; some places add their own actions. */
export type SurahMenuOrigin =
  | 'continue'
  | 'loved'
  | 'playlist'
  | 'surahs'
  | 'reciter'
  | 'search'
  | 'home';

export type SurahMenuTarget = {
  kind: 'surah';
  surahNumber: number;
  reciterId?: string;
  rewayahId?: string;
  origin?: SurahMenuOrigin;
  /** With origin 'playlist': the playlist the surah is in. */
  playlistId?: string;
};

export type ContextMenuTarget =
  | {kind: 'reciter'; reciterId: string}
  | SurahMenuTarget
  | null;

type State = {
  target: ContextMenuTarget;
  /** The reciter whose menu is open; null for a surah menu or none. */
  reciterId: string | null;
  /** Opens a reciter's menu (kept as `open` for existing callers). */
  open: (id: string) => void;
  openReciter: (id: string) => void;
  openSurah: (target: Omit<SurahMenuTarget, 'kind'>) => void;
  close: () => void;
};

export const useContextMenuStore = create<State>(set => {
  const openReciter = (reciterId: string): void =>
    set({target: {kind: 'reciter', reciterId}, reciterId});
  return {
    target: null,
    reciterId: null,
    open: openReciter,
    openReciter,
    openSurah: target =>
      set({target: {kind: 'surah', ...target}, reciterId: null}),
    close: () => set({target: null, reciterId: null}),
  };
});
