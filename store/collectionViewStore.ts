// @ai-generated
import {create} from 'zustand';
import {createMMKV} from 'react-native-mmkv';

/** The screens behind the Collection tab that remember a view and a sort. */
export type CollectionScreenKey =
  | 'loved'
  | 'playlists'
  | 'downloads'
  | 'bookmarks'
  | 'notes'
  | 'reciters'
  | 'uploads'
  /** Browse › All reciters (not a Collection screen, same memory). @ai */
  | 'browseReciters';

export type CollectionView = 'grid' | 'list';

export interface CollectionViewPref {
  view: CollectionView;
  /** One of the screen's sort ids (see `COLLECTION_SORTS`). */
  sort: string;
}

/** Sort ids each screen offers, first one is the default. */
export const COLLECTION_SORTS: Record<CollectionScreenKey, string[]> = {
  loved: ['recent', 'surah', 'reciter', 'title'],
  playlists: ['updated', 'title', 'created'],
  downloads: ['recent', 'surah', 'size'],
  bookmarks: ['recent', 'oldest', 'surah'],
  notes: ['recent', 'oldest', 'surah'],
  reciters: ['recent', 'name'],
  uploads: ['recent', 'oldest', 'title'],
  browseReciters: ['name', 'recent'],
};

/** Screens that switch between a grid and a list. */
export const COLLECTION_HAS_VIEW: Record<CollectionScreenKey, boolean> = {
  loved: true,
  playlists: true,
  downloads: true,
  bookmarks: false,
  notes: false,
  reciters: false,
  uploads: false,
  browseReciters: true,
};

const DEFAULT_VIEW: Record<CollectionScreenKey, CollectionView> = {
  loved: 'list',
  playlists: 'grid',
  downloads: 'list',
  bookmarks: 'list',
  notes: 'list',
  reciters: 'list',
  uploads: 'list',
  browseReciters: 'grid', // @ai: grid first, as Osman asked
};

// Read synchronously at launch so a screen opens in the view it was left in.
const mmkv = createMMKV({id: 'collection-view'});

// @ai: Browse reciters' default became grid; a new key so a List saved
// under the old default doesn't stick.
const storageKey = (screen: CollectionScreenKey): string =>
  screen === 'browseReciters' ? 'browseReciters.v2' : screen;

function read(screen: CollectionScreenKey): CollectionViewPref {
  const fallback = {
    view: DEFAULT_VIEW[screen],
    sort: COLLECTION_SORTS[screen][0],
  };
  try {
    const raw = mmkv.getString(storageKey(screen));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CollectionViewPref>;
    return {
      view:
        parsed.view === 'grid' || parsed.view === 'list'
          ? parsed.view
          : fallback.view,
      sort:
        parsed.sort && COLLECTION_SORTS[screen].includes(parsed.sort)
          ? parsed.sort
          : fallback.sort,
    };
  } catch {
    return fallback;
  }
}

const SCREENS = Object.keys(COLLECTION_SORTS) as CollectionScreenKey[];

interface CollectionViewState {
  prefs: Record<CollectionScreenKey, CollectionViewPref>;
  /** Downloads: every surah in one list (default), or grouped by reciter. */
  downloadsGrouping: 'reciter' | 'surah';
  setView: (screen: CollectionScreenKey, view: CollectionView) => void;
  setSort: (screen: CollectionScreenKey, sort: string) => void;
  setDownloadsGrouping: (grouping: 'reciter' | 'surah') => void;
}

export const useCollectionViewStore = create<CollectionViewState>()(set => ({
  prefs: Object.fromEntries(SCREENS.map(s => [s, read(s)])) as Record<
    CollectionScreenKey,
    CollectionViewPref
  >,
  downloadsGrouping:
    // All surahs is the default; only a saved "By reciter" overrides it.
    // A new key, so the old saved default ("reciter") doesn't stick.
    mmkv.getString('downloadsGrouping.v2') === 'reciter' ? 'reciter' : 'surah',
  setView: (screen, view) =>
    set(state => {
      const next = {...state.prefs[screen], view};
      mmkv.set(storageKey(screen), JSON.stringify(next));
      return {prefs: {...state.prefs, [screen]: next}};
    }),
  setSort: (screen, sort) =>
    set(state => {
      const next = {...state.prefs[screen], sort};
      mmkv.set(storageKey(screen), JSON.stringify(next));
      return {prefs: {...state.prefs, [screen]: next}};
    }),
  setDownloadsGrouping: grouping => {
    mmkv.set('downloadsGrouping.v2', grouping);
    set({downloadsGrouping: grouping});
  },
}));

/** A screen's remembered view and sort, with setters. */
export function useCollectionViewPref(screen: CollectionScreenKey) {
  const pref = useCollectionViewStore(s => s.prefs[screen]);
  const setView = useCollectionViewStore(s => s.setView);
  const setSort = useCollectionViewStore(s => s.setSort);
  return {
    ...pref,
    setView: (view: CollectionView) => setView(screen, view),
    setSort: (sort: string) => setSort(screen, sort),
  };
}
