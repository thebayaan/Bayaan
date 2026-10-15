// services/widgets/syncContentWidgets.ts
import {AppState} from 'react-native';
import {
  cacheArtwork,
  changedContentKindsForContent,
  changedContentKindsForSnapshot,
  ContentWidgetKind,
  hasArtwork,
  isWidgetsAvailable,
  PLAYLIST_LIMIT,
  reloadWidgets,
  writeContent,
  WidgetContent,
} from 'bayaan-widgets';
import type {Reciter} from '@/data/reciterData';
import {
  getBayaanOriginalsReciters,
  getFeaturedReciters,
  getTrendingReciters,
} from '@/data/reciterCollections';
import type {DownloadedSurah} from '@/services/player/store/downloadStore';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {usePlaylistsStore} from '@/store/playlistsStore';
import {useReciterStore} from '@/store/reciterStore';
import {playlistService} from '@/services/playlist/PlaylistService';
import {getReciterByIdSync, getSurahById} from '@/services/dataService';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {buildContent, PlaylistWithItems} from './buildContent';
import {surahArtworkFileName, surahArtworkUrl} from './buildSnapshot';
import {addSnapshotListener} from './syncWidgets';
import {setContentCommandRunner} from './handleWidgetCommand';
import {runContentCommand} from './contentCommands';
import {enabledKinds, isWidgetEnabled} from './enabledWidgets';

setContentCommandRunner(runContentCommand);

const DEBOUNCE_MS = 1000;
const ARTWORK_RETRY_MS = 10 * 60 * 1000;
// Widgets showing artwork that arrives after the content write.
const ARTWORK_KINDS: ContentWidgetKind[] = [
  'LibraryShelf',
  'ReciterSpotlight',
  'BayaanNow',
];

let lastContent: WidgetContent | null = null;
let cachedPlaylists: PlaylistWithItems[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;
let again = false;
let pendingPlaylists = false;
const artworkFailures = new Map<string, number>();

/** For tests: forget everything written so far. */
export function resetContentSync(): void {
  lastContent = null;
  cachedPlaylists = [];
  if (timer) clearTimeout(timer);
  timer = null;
  flushing = null;
  again = false;
  pendingPlaylists = false;
  artworkFailures.clear();
}

export function spotlightReciters(): Reciter[] {
  return [
    ...getFeaturedReciters(),
    ...getBayaanOriginalsReciters(),
    ...getTrendingReciters(),
  ];
}

export function contentArtworkJobs(
  content: WidgetContent,
  isCached: (file: string) => boolean,
  reciterArtworkUrl: (reciterId: string) => string | null,
): Map<string, string> {
  const jobs = new Map<string, string>();
  const surahIds = new Set<number>([
    ...content.downloads.map(i => i.surahId),
    ...content.playlists.flatMap(p => p.items.map(i => i.surahId)),
  ]);
  for (const id of surahIds) {
    const file = surahArtworkFileName(id);
    if (!isCached(file)) jobs.set(file, surahArtworkUrl(id));
  }
  for (const r of content.spotlight) {
    if (isCached(r.artworkFile)) continue;
    const url = reciterArtworkUrl(r.id);
    if (url) jobs.set(r.artworkFile, url);
  }
  return jobs;
}

function reciterArtworkUrl(reciterId: string): string | null {
  const reciter = getReciterByIdSync(reciterId);
  if (!reciter) return null;
  const url = getReciterArtwork(reciter);
  return url.startsWith('data:') ? null : url;
}

async function cacheContentArtwork(content: WidgetContent): Promise<boolean> {
  let added = false;
  for (const [file, url] of contentArtworkJobs(
    content,
    hasArtwork,
    reciterArtworkUrl,
  )) {
    const failedAt = artworkFailures.get(url);
    if (failedAt !== undefined && Date.now() - failedAt < ARTWORK_RETRY_MS) {
      continue;
    }
    try {
      if (await cacheArtwork(url, file)) {
        artworkFailures.delete(url);
        added = true;
      } else {
        artworkFailures.set(url, Date.now());
      }
    } catch (error) {
      artworkFailures.set(url, Date.now());
      console.error('[WidgetSync] Failed to cache content artwork:', error);
    }
  }
  return added;
}

async function loadPlaylists(): Promise<PlaylistWithItems[]> {
  const all = await playlistService.getAllPlaylists();
  const recent = [...all]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, PLAYLIST_LIMIT);
  return Promise.all(
    recent.map(async playlist => ({
      playlist,
      items: await playlistService.getPlaylistItems(playlist.id),
    })),
  );
}

async function flushOnce(reloadPlaylists: boolean): Promise<void> {
  if (reloadPlaylists && isWidgetEnabled('LibraryShelf')) {
    try {
      cachedPlaylists = await loadPlaylists();
    } catch (error) {
      console.error(
        '[WidgetSync] Failed to read playlists for widgets:',
        error,
      );
    }
  }
  const next = buildContent({
    now: Date.now(),
    downloads: useDownloadStore.getState().downloads,
    playlists: cachedPlaylists,
    spotlight: isWidgetEnabled('ReciterSpotlight') ? spotlightReciters() : [],
    sleepTimerEnd: usePlayerStore.getState().settings.sleepTimerEnd,
    surahName: id => getSurahById(id)?.name ?? null,
    reciterName: id => getReciterByIdSync(id)?.name ?? null,
  });
  const kinds = changedContentKindsForContent(lastContent, next);
  if (kinds.length > 0) {
    writeContent(next);
    reloadWidgets(enabledKinds(kinds));
    lastContent = next;
  }
  if (lastContent && (await cacheContentArtwork(lastContent))) {
    reloadWidgets(enabledKinds(ARTWORK_KINDS));
  }
}

// Serialized: a flush requested while one runs runs once more afterwards.
export function flushContent(reloadPlaylists = false): Promise<void> {
  pendingPlaylists = pendingPlaylists || reloadPlaylists;
  if (flushing) {
    again = true;
    return flushing;
  }
  const run = async (): Promise<void> => {
    try {
      do {
        again = false;
        const reload = pendingPlaylists;
        pendingPlaylists = false;
        try {
          await flushOnce(reload);
        } catch (error) {
          console.error('[WidgetSync] Failed to flush widget content:', error);
        }
      } while (again);
    } finally {
      flushing = null;
    }
  };
  flushing = run();
  return flushing;
}

function completedKey(downloads: DownloadedSurah[]): string {
  return downloads
    .filter(d => d.status === 'completed')
    .map(d => `${d.reciterId}:${d.surahId}:${d.rewayatId}:${d.downloadDate}`)
    .join('|');
}

function runFlush(reloadPlaylists = false): void {
  flushContent(reloadPlaylists).catch(error => {
    console.error('[WidgetSync] Content flush failed:', error);
  });
}

function schedule(reloadPlaylists = false): void {
  pendingPlaylists = pendingPlaylists || reloadPlaylists;
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    runFlush();
  }, DEBOUNCE_MS);
}

// Adhkar, Hijri Date and Occasion depend only on the date, so nothing else
// reloads them. Reloading on launch and foreground refreshes them and lets
// Android re-arm its context alarm after a force stop.
const DATE_KINDS: ContentWidgetKind[] = ['Adhkar', 'HijriDate', 'Occasion'];

// Started by the root layout next to startWidgetSync.
export function startContentWidgetSync(): () => void {
  if (!isWidgetsAvailable()) return () => undefined;
  reloadWidgets(enabledKinds(DATE_KINDS));
  runFlush(true);
  const unsubs = [
    addSnapshotListener((prev, next) => {
      const kinds = changedContentKindsForSnapshot(prev, next);
      reloadWidgets(enabledKinds(kinds));
    }),
    useDownloadStore.subscribe((state, prev) => {
      if (state.downloads === prev.downloads) return;
      // Progress ticks replace the array; only completed downloads matter.
      if (completedKey(state.downloads) !== completedKey(prev.downloads))
        schedule();
    }),
    usePlaylistsStore.subscribe((state, prev) => {
      if (state.playlists !== prev.playlists) schedule(true);
    }),
    // Not debounced: Android pauses JS timers in the background.
    usePlayerStore.subscribe((state, prev) => {
      if (state.settings.sleepTimerEnd !== prev.settings.sleepTimerEnd) {
        runFlush();
      }
    }),
    // RECITERS fills in place after the catalog loads; the spotlight follows.
    useReciterStore.subscribe(() => schedule()),
  ];
  const appState = AppState.addEventListener('change', state => {
    if (state !== 'active') return;
    reloadWidgets(enabledKinds(DATE_KINDS));
    runFlush(true);
  });
  return () => {
    unsubs.forEach(u => u());
    appState.remove();
    if (timer) clearTimeout(timer);
    timer = null;
  };
}
