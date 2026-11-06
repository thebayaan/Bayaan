// @ai-generated
import {getAllReciters, getReciterByIdSync} from '@/services/dataService';
import {useFavoriteRecitersStore} from '@/services/player/store/favoriteRecitersStore';
import {
  useLovedStore,
  type LovedTrack,
} from '@/services/player/store/lovedStore';
import {
  decodePlaylistEntries,
  isLibraryId,
  lovedDocumentKey,
  playlistEntries,
  type PlaylistDocument,
  lovedDocumentSurah,
  lovedEntryKey,
  splitLovedEntryKey,
} from './qfLibraryDocuments';
import {sameEntries, type LibraryEntries} from './qfLibraryMerge';
import type {QfLibraryLocalAdapter} from './qfLibrarySync';
import {onLibraryEdited} from './libraryEdits';
import {playlistService} from '@/services/playlist/PlaylistService';
import {usePlaylistsStore} from '@/store/playlistsStore';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {useAdhkarStore} from '@/store/adhkarStore';

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
 * Calls `onEdit` (debounced) when the user changes favourite reciters, loved
 * tracks, playlists or saved adhkar, so a signed-in device syncs them soon
 * after.
 */
export function watchLibraryEdits(onEdit: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const edited = () => {
    if (applyingRemote > 0) return;
    clearTimeout(timer);
    timer = setTimeout(onEdit, EDIT_DEBOUNCE_MS);
  };
  const unsubscribers = [
    onLibraryEdited(edited),
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

// --------------------------------------------------------------- playlists

const PLAYLIST_KEY = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * One playlist as synced. Items from the user's own uploads only exist on
 * this device, so they are left out (and kept locally when applying).
 */
async function readPlaylist(id: string): Promise<LibraryEntries | null> {
  const playlist = await playlistService.getPlaylist(id);
  if (!playlist) return null;
  return playlistEntriesFor(
    playlist,
    await playlistService.getPlaylistItems(id),
  );
}

function playlistEntriesFor(
  playlist: {
    name: string;
    color: string;
    description?: string;
    createdAt: number;
  },
  items: {
    surahId: string;
    reciterId: string;
    rewayatId?: string;
    userRecitationId?: string;
  }[],
): LibraryEntries | null {
  const document: PlaylistDocument = {
    name: playlist.name,
    color: playlist.color,
    description: playlist.description ? playlist.description : null,
    createdAt: playlist.createdAt,
    items: items.flatMap(item => {
      const surah = Number(item.surahId);
      if (
        item.userRecitationId ||
        !Number.isInteger(surah) ||
        surah < 1 ||
        surah > 114 ||
        !isLibraryId(item.reciterId) ||
        (item.rewayatId && !isLibraryId(item.rewayatId))
      ) {
        return [];
      }
      return [
        [surah, item.reciterId, item.rewayatId ?? ''] as [
          number,
          string,
          string,
        ],
      ];
    }),
  };
  // A playlist this version can't express (e.g. an over-long name) stays local.
  return decodePlaylistEntries(playlistEntries(document))
    ? playlistEntries(document)
    : null;
}

export function createPlaylistsAdapter(): QfLibraryLocalAdapter {
  return {
    collection: 'playlists',
    deletable: true,
    async readLocal() {
      const documents = new Map<string, LibraryEntries>();
      for (const playlist of await playlistService.getAllPlaylists()) {
        if (!PLAYLIST_KEY.test(playlist.id)) continue;
        const entries = playlistEntriesFor(
          playlist,
          await playlistService.getPlaylistItems(playlist.id),
        );
        if (entries) documents.set(playlist.id, entries);
      }
      return documents;
    },
    async applyLocal(key, expected, next) {
      const current = await readPlaylist(key);
      const unchanged =
        current === null || expected === null
          ? current === expected
          : sameEntries(current, expected);
      if (!unchanged) return false;
      const playlist = next ? decodePlaylistEntries(next) : null;
      if (next && !playlist) return false;
      await playlistService.replacePlaylistFromSync(
        key,
        playlist
          ? {
              name: playlist.name,
              color: playlist.color,
              description: playlist.description,
              createdAt: playlist.createdAt,
              items: playlist.items.map(([surah, reciterId, rewayatId]) => ({
                surahId: String(surah),
                reciterId,
                rewayatId,
              })),
            }
          : null,
      );
      await usePlaylistsStore.getState().loadPlaylists();
      return true;
    },
  };
}

// ------------------------------------------------------------ saved adhkar

async function readSavedAdhkar(): Promise<Record<string, number>> {
  const saved: Record<string, number> = {};
  for (const item of await adhkarService.getSaved()) {
    saved[item.dhikrId] = item.createdAt;
  }
  return saved;
}

function savedEntries(saved: Record<string, number>): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const [id, createdAt] of Object.entries(saved)) {
    if (isLibraryId(id) && Number.isSafeInteger(createdAt) && createdAt >= 0) {
      entries[id] = String(createdAt);
    }
  }
  return entries;
}

export function createAdhkarAdapter(): QfLibraryLocalAdapter {
  return {
    collection: 'adhkar',
    deletable: false,
    async readLocal() {
      return new Map([['saved', savedEntries(await readSavedAdhkar())]]);
    },
    async applyLocal(key, expected, next) {
      if (key !== 'saved') return false;
      const current = await readSavedAdhkar();
      if (!sameOrAbsent(savedEntries(current), expected)) return false;
      // Saved adhkar the sync can't represent stay as they are.
      const unsyncable = Object.entries(current).filter(
        ([id]) => !(id in savedEntries({[id]: current[id]})),
      );
      const replaced = await adhkarService.replaceSaved(current, [
        ...Object.entries(next ?? {}).map(([dhikrId, time]) => ({
          dhikrId,
          createdAt: Number(time),
        })),
        ...unsyncable.map(([dhikrId, createdAt]) => ({dhikrId, createdAt})),
      ]);
      if (replaced) await useAdhkarStore.getState().loadSaved();
      return replaced;
    },
  };
}
