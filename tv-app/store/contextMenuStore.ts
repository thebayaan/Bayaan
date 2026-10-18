import {create} from 'zustand';
import {
  restoreFocusTo,
  takeFocusClaim,
  takeLongPressOrigin,
  type FocusRef,
} from '../services/focusReturn';
import {useNavStore} from './navStore';

/** Where a surah menu was opened from; some places add their own actions. */
export type SurahMenuOrigin =
  | 'continue'
  | 'loved'
  | 'playlist'
  | 'surahs'
  | 'reciter'
  | 'search'
  | 'home'
  | 'player';

export type SurahMenuTarget = {
  kind: 'surah';
  surahNumber: number;
  reciterId?: string;
  rewayahId?: string;
  origin?: SurahMenuOrigin;
  /** With origin 'playlist': the playlist the surah is in... */
  playlistId?: string;
  /** ...and its position there (moving it updates this). */
  playlistIndex?: number;
  /**
   * Open straight on the playlist picker (the player's Save tool); Back then
   * closes the menu rather than going to its first page.
   */
  page?: 'playlists';
};

export type ReciterMenuTarget = {kind: 'reciter'; reciterId: string};

export type ContextMenuTarget = ReciterMenuTarget | SurahMenuTarget | null;

type CloseOptions = {
  /**
   * Give focus back to the view that opened the menu (default). Actions that
   * leave the screen pass false: the view is going away.
   */
  restoreFocus?: boolean;
};

type State = {
  target: ContextMenuTarget;
  /** The reciter whose menu is open; null for a surah menu or none. */
  reciterId: string | null;
  /** The view that opened the menu, focused again when it closes. */
  opener: FocusRef | null;
  /** Opens a reciter's menu (kept as `open` for existing callers). */
  open: (id: string, opener?: FocusRef | null) => void;
  openReciter: (id: string, opener?: FocusRef | null) => void;
  openSurah: (
    target: Omit<SurahMenuTarget, 'kind'>,
    opener?: FocusRef | null,
  ) => void;
  /** Changes the open surah menu's target in place (a moved playlist row). */
  updateSurah: (change: Partial<Omit<SurahMenuTarget, 'kind'>>) => void;
  close: (options?: CloseOptions) => void;
};

/**
 * The one long-press menu, for a reciter or a surah. It remembers the view
 * that opened it (passed in, or noted by the long-press) and hands focus
 * back to it on close. Any navigation closes it, so a menu never carries
 * over to another screen.
 */
export const useContextMenuStore = create<State>((set, get) => {
  const openReciter = (reciterId: string, opener?: FocusRef | null): void =>
    set({
      target: {kind: 'reciter', reciterId},
      reciterId,
      opener: opener ?? takeLongPressOrigin(),
    });
  return {
    target: null,
    reciterId: null,
    opener: null,
    open: openReciter,
    openReciter,
    openSurah: (target, opener) =>
      set({
        target: {kind: 'surah', ...target},
        reciterId: null,
        opener: opener ?? takeLongPressOrigin(),
      }),
    updateSurah: change =>
      set(s =>
        s.target?.kind === 'surah' ? {target: {...s.target, ...change}} : s,
      ),
    close: ({restoreFocus = true} = {}) => {
      const {target, opener} = get();
      if (!target) return;
      set({target: null, reciterId: null, opener: null});
      // Subscribers ran during set(): a screen that placed focus itself
      // (its tile went away) has claimed it.
      const claimed = takeFocusClaim();
      if (restoreFocus && !claimed) restoreFocusTo(opener);
    },
  };
});

// Leaving the screen (a push, pop or tab switch) closes the menu.
useNavStore.subscribe((next, prev) => {
  if (next.stack !== prev.stack || next.currentTab !== prev.currentTab) {
    useContextMenuStore.getState().close({restoreFocus: false});
  }
});
