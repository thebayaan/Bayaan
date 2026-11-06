import {getAllReciters, getReciterByIdSync} from '@/services/dataService';
import {useFavoriteRecitersStore} from '@/services/player/store/favoriteRecitersStore';
import {
  useLovedStore,
  type LovedTrack,
} from '@/services/player/store/lovedStore';
import {
  isLibraryId,
  lovedDocumentKey,
  lovedDocumentSurah,
  lovedEntryKey,
  splitLovedEntryKey,
} from './qfLibraryDocuments';
import {sameEntries, type LibraryEntries} from './qfLibraryMerge';
import type {QfLibraryLocalAdapter} from './qfLibrarySync';

interface PersistedStore {
  persist?: {
    hasHydrated(): boolean;
    onFinishHydration(callback: () => void): () => void;
  };
}

/** Zustand persist stores must finish loading before sync reads them. */
export function waitForHydration(store: PersistedStore): Promise<void> {
  const persist = store.persist;
  if (!persist || persist.hasHydrated()) return Promise.resolve();
  return new Promise(resolve => {
    const unsubscribe = persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
    if (persist.hasHydrated()) {
      unsubscribe();
      resolve();
    }
  });
}

// Store changes made by sync itself are not local edits.
let applyingRemote = 0;

function applyRemote(apply: () => void) {
  applyingRemote++;
  try {
    apply();
  } finally {
    applyingRemote--;
  }
}

const EDIT_DEBOUNCE_MS = 1_500;

/**
 * Calls `onEdit` (debounced) when the user changes favourite reciters or
 * loved tracks, so a signed-in device syncs them soon after.
 */
export function watchLibraryEdits(onEdit: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const edited = () => {
    if (applyingRemote > 0) return;
    clearTimeout(timer);
    timer = setTimeout(onEdit, EDIT_DEBOUNCE_MS);
  };
  const unsubscribers = [
    useFavoriteRecitersStore.subscribe((state, previous) => {
      if (state.favoriteReciters !== previous.favoriteReciters) edited();
    }),
    useLovedStore.subscribe((state, previous) => {
      if (state.tracks !== previous.tracks) edited();
    }),
  ];
  return () => {
    clearTimeout(timer);
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

function sameOrAbsent(
  left: LibraryEntries | null,
  right: LibraryEntries | null,
) {
  const a = left ?? {};
  const b = right ?? {};
  return sameEntries(a, b);
}

// ---------------------------------------------------------------- reciters

function favoriteEntries(): Record<string, string> {
  const {favoriteReciters} = useFavoriteRecitersStore.getState();
  const entries: Record<string, string> = {};
  for (const [id, reciter] of Object.entries(favoriteReciters)) {
    if (isLibraryId(id)) entries[id] = String(reciter.favoritedAt);
  }
  return entries;
}

/**
 * The `library` collection: favourite reciters and loved tracks.
 *
 * A synced favourite whose reciter this device's catalog doesn't have yet
 * (a newer catalog elsewhere) can't be shown, so it is kept as if present
 * rather than read as a removal.
 */
export function createLibraryAdapter(): QfLibraryLocalAdapter {
  let synced: ReadonlyMap<string, LibraryEntries> = new Map();

  const readReciters = (): Record<string, string> => {
    const entries = favoriteEntries();
    for (const [id, time] of Object.entries(synced.get('reciters') ?? {})) {
      if (!(id in entries) && !getReciterByIdSync(id)) entries[id] = time;
    }
    return entries;
  };

  return {
    collection: 'library',
    deletable: false,
    async readLocal(syncedEntries) {
      synced = syncedEntries;
      await Promise.all([
        waitForHydration(useFavoriteRecitersStore as PersistedStore),
        waitForHydration(useLovedStore as PersistedStore),
        // Favourites are stored with their reciter, so the catalog must load.
        getAllReciters().catch(() => undefined),
      ]);
      const documents = new Map<string, LibraryEntries>();
      documents.set('reciters', readReciters());
      for (const [surah, entries] of lovedBySurah()) {
        documents.set(lovedDocumentKey(surah), entries);
      }
      return documents;
    },
    async applyLocal(key, expected, next) {
      if (key === 'reciters') {
        if (!sameOrAbsent(readReciters(), expected)) return false;
        applyRemote(() => applyReciters(next ?? {}));
        return true;
      }
      const surah = lovedDocumentSurah(key);
      if (!surah) return false;
      const current = lovedBySurah().get(surah) ?? {};
      if (!sameOrAbsent(current, expected)) return false;
      applyRemote(() => applyLoved(surah, next ?? {}));
      return true;
    },
  };
}

function applyReciters(next: LibraryEntries) {
  const store = useFavoriteRecitersStore.getState();
  const favoriteReciters = {...store.favoriteReciters};
  for (const id of Object.keys(favoriteReciters)) {
    if (isLibraryId(id) && !(id in next)) delete favoriteReciters[id];
  }
  for (const [id, time] of Object.entries(next)) {
    const reciter = favoriteReciters[id] ?? getReciterByIdSync(id);
    // Not in this device's catalog yet: kept in sync state, not shown.
    if (!reciter) continue;
    favoriteReciters[id] = {...reciter, favoritedAt: Number(time)};
  }
  const favoriteReciterIds = Object.values(favoriteReciters)
    .sort((a, b) => a.favoritedAt - b.favoritedAt)
    .map(reciter => reciter.id);
  useFavoriteRecitersStore.setState({favoriteReciterIds, favoriteReciters});
}

// ------------------------------------------------------------------- loved

function syncableSurah(track: LovedTrack): number | undefined {
  // Tracks from the user's own uploads only exist on this device.
  if (track.userRecitationId) return undefined;
  const surah = Number(track.surahId);
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return undefined;
  if (!isLibraryId(track.reciterId)) return undefined;
  if (track.rewayatId && !isLibraryId(track.rewayatId)) return undefined;
  if (!Number.isSafeInteger(track.timestamp) || track.timestamp < 0) {
    return undefined;
  }
  return surah;
}

function lovedBySurah(): Map<number, Record<string, string>> {
  const bySurah = new Map<number, Record<string, string>>();
  for (const track of useLovedStore.getState().tracks) {
    const surah = syncableSurah(track);
    if (!surah) continue;
    const entries = bySurah.get(surah) ?? {};
    const key = lovedEntryKey(track.reciterId, track.rewayatId ?? '');
    // Keep the earliest love if a duplicate slipped in.
    if (!(key in entries) || Number(entries[key]) > track.timestamp) {
      entries[key] = String(track.timestamp);
    }
    bySurah.set(surah, entries);
  }
  return bySurah;
}

function applyLoved(surah: number, next: LibraryEntries) {
  const tracks = useLovedStore.getState().tracks;
  const kept: LovedTrack[] = [];
  const existing = new Map<string, LovedTrack>();
  for (const track of tracks) {
    if (syncableSurah(track) === surah) {
      existing.set(
        lovedEntryKey(track.reciterId, track.rewayatId ?? ''),
        track,
      );
    } else {
      kept.push(track);
    }
  }
  const synced = Object.entries(next).map(([key, time]): LovedTrack => {
    const [reciterId, rewayatId] = splitLovedEntryKey(key);
    const previous = existing.get(key);
    return {
      reciterId,
      // Keep the device's own spelling of the surah id when it had one.
      surahId: previous?.surahId ?? String(surah),
      rewayatId,
      timestamp: Number(time),
    };
  });
  const merged = [...kept, ...synced].sort((a, b) => b.timestamp - a.timestamp);
  useLovedStore.setState({tracks: merged});
}
