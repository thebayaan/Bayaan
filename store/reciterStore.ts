import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {persistStorage} from '@/utils/storage'; // @ai
import {Reciter, RECITERS} from '@/data/reciterData';
import {HAFS_REWAYAT_NAME} from '@/data/rewayat';

// Helper function to get the Hafs A'n Assem rewayat from a reciter
function getHafsRewayat(reciter: Reciter) {
  return reciter.rewayat.find(r => r.name === HAFS_REWAYAT_NAME);
}

// @ai-start
/** Mishary Alafasi: the default reciter until the user picks one. */
export const BUILT_IN_DEFAULT_RECITER_ID =
  'b3bca7d8-b004-4511-b46e-f3527f6b1f67';

// RECITERS is empty on first launch before API data loads, so the store starts
// with this placeholder until the catalog arrives.
const EMPTY_RECITER: Reciter = {
  id: '',
  name: '',
  date: null,
  image_url: null,
  rewayat: [],
};

// Ensure the default rewayat is Hafs if available
function withHafsFirst(reciter: Reciter): Reciter {
  const hafsRewayat = getHafsRewayat(reciter);
  if (!hafsRewayat) return reciter;
  return {
    ...reciter,
    rewayat: [
      hafsRewayat,
      ...reciter.rewayat.filter(r => r.id !== hafsRewayat.id),
    ],
  };
}

/**
 * The default reciter for a picked id, read from the current catalog: the
 * picked reciter when it is in the catalog, otherwise the built-in default,
 * otherwise any Hafs reciter. Null while the catalog is empty.
 */
function resolveDefaultReciter(pickedId: string | null): Reciter | null {
  if (RECITERS.length === 0) return null;
  const byId = (id: string | null) =>
    id ? RECITERS.find(reciter => reciter.id === id) : undefined;
  const reciter =
    byId(pickedId) ??
    byId(BUILT_IN_DEFAULT_RECITER_ID) ??
    RECITERS.find(r => getHafsRewayat(r)) ??
    RECITERS[0];
  return withHafsFirst(reciter);
}

interface DefaultReciterPick {
  defaultReciterId: string | null;
}

/**
 * The user's pick, and the only reciter state that is saved. It changes only
 * when the user picks, so loading the catalog can never write over it.
 */
const useDefaultReciterPick = create<DefaultReciterPick>()(
  persist((): DefaultReciterPick => ({defaultReciterId: null}), {
    name: 'reciter-storage',
    storage: persistStorage(),
    // v0 saved the whole reciter object; keep only its id.
    version: 1,
    migrate: (persisted, version) => {
      if (version === 0) {
        const saved = persisted as {defaultReciter?: {id?: string}} | null;
        return {defaultReciterId: saved?.defaultReciter?.id || null};
      }
      return persisted as DefaultReciterPick;
    },
  }),
);

/** The current pick resolved against the catalog, or null before it loads. */
const resolvePick = () =>
  resolveDefaultReciter(useDefaultReciterPick.getState().defaultReciterId);
// @ai-end

interface ReciterState {
  /** The pick resolved against the catalog. Not saved. */
  defaultReciter: Reciter;
  /** True once the reciter catalog has loaded. */
  isInitialized: boolean;
  setDefaultReciter: (reciter: Reciter) => void;
  catalogLoaded: () => void;
}

// @ai-start
export const useReciterStore = create<ReciterState>()(set => ({
  defaultReciter: EMPTY_RECITER,
  isInitialized: false,
  setDefaultReciter: reciter =>
    useDefaultReciterPick.setState({defaultReciterId: reciter.id}),
  // Called by dataService each time RECITERS is repopulated.
  catalogLoaded: () => {
    const reciter = resolvePick();
    set(
      reciter
        ? {defaultReciter: reciter, isInitialized: true}
        : {isInitialized: true},
    );
  },
}));

// A new pick, or the saved pick arriving from storage, re-resolves the
// default. Before the catalog loads there is nothing to resolve against.
useDefaultReciterPick.subscribe(() => {
  const reciter = resolvePick();
  if (reciter) useReciterStore.setState({defaultReciter: reciter});
});
// @ai-end
