import {AppState, Image} from 'react-native';
import branding from '@/config/branding';
import {isFeatureEnabled} from '@/config/featureFlags';
import {BayaanCar} from '@/modules/bayaan-car';
import {RECITERS, Reciter} from '@/data/reciterData';
import {SURAHS} from '@/data/surahData';
import {getSystemPlaylists} from '@/data/systemPlaylists';
import {SURAH_TO_JUZ} from '@/data/juzData';
import {getLocalReciterImage} from '@/utils/reciterImageLookup'; // @ai
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {localAggregationStore} from '@/services/analytics/LocalAggregationStore';
import {useLovedStore} from '@/services/player/store/lovedStore';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {useFavoriteRecitersStore} from '@/services/player/store/favoriteRecitersStore';
import {usePlaylistsStore} from '@/store/playlistsStore';
import {useReciterStore} from '@/store/reciterStore';
import {useUploadsStore} from '@/store/uploadsStore';
import {PlaylistItem} from '@/services/database/DatabaseService';
import {buildCarSnapshot} from '@/services/car/snapshot/buildCarSnapshot';
import {
  DailySurahListening,
  playCountsFromDailyListening,
} from '@/services/car/snapshot/personalized';
import {CarArtwork} from '@/services/car/types';
import {CarResolveContext} from '@/services/car/playback/resolveCarRequest';
import {recentTracksKey, uploadsKey} from '@/services/car/snapshotKeys';

const DEBOUNCE_MS = 2000;
const MAX_WAIT_MS = 10_000;
const CONNECTED_REFRESH_MS = 15 * 60 * 1000;
/** How far back "On repeat" looks. */
const ON_REPEAT_WINDOW_DAYS = 30;
const MONOGRAM_COLORS = [
  '#0F766E',
  '#1D4ED8',
  '#7C3AED',
  '#B45309',
  '#BE123C',
  '#15803D',
];

function monogram(reciter: Reciter): CarArtwork {
  const label = reciter.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
  let hash = 0;
  for (const ch of reciter.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    kind: 'monogram',
    label,
    hex: MONOGRAM_COLORS[hash % MONOGRAM_COLORS.length],
  };
}

export function resolveReciterArtwork(reciter: Reciter): CarArtwork {
  if (reciter.image_url) {
    return {
      kind: 'url',
      url: reciter.image_url.replace(/^http:\/\//, 'https://'),
    };
  }
  const asset = getLocalReciterImage(reciter.name); // @ai
  if (asset !== undefined) {
    const resolved = Image.resolveAssetSource(asset);
    if (resolved?.uri) return {kind: 'asset', uri: resolved.uri};
  }
  return monogram(reciter);
}

async function loadPlaylistItems(): Promise<Record<string, PlaylistItem[]>> {
  const {playlists, getPlaylistItems} = usePlaylistsStore.getState();
  const entries = await Promise.all(
    playlists.map(
      async (p): Promise<[string, PlaylistItem[]]> => [
        p.id,
        await getPlaylistItems(p.id),
      ],
    ),
  );
  return Object.fromEntries(entries);
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pendingSince: number | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let lastContext: CarResolveContext | null = null;
let lastWrittenBody: string | null = null;
let startedSeq = 0;
let committedSeq = 0;

// The exact data the last written snapshot was built from. The resolver must
// use this, not live stores, so startIndex matches the list the car shows.
export function getLastResolveContext(): CarResolveContext | null {
  return lastContext;
}

export async function writeCarSnapshotNow(): Promise<void> {
  const seq = ++startedSeq;
  const playlistItems = await loadPlaylistItems();
  const uploadsState = useUploadsStore.getState();
  const context: CarResolveContext = Object.freeze({
    // RECITERS is refilled in place when the catalog loads; copy so the
    // frozen context keeps the list this snapshot was built from.
    reciters: [...RECITERS],
    topReciterId: null,
    recentTracks: useRecentlyPlayedStore.getState().recentTracks,
    lovedTracks: useLovedStore.getState().tracks,
    downloads: useDownloadStore.getState().downloads,
    systemPlaylists: getSystemPlaylists(),
    playlistItems,
    uploads: uploadsState.recitations,
  });
  const snapshot = buildCarSnapshot({
    now: new Date(),
    reciters: context.reciters,
    surahs: SURAHS,
    favoriteReciterIds: useFavoriteRecitersStore.getState().favoriteReciterIds,
    defaultReciterId: useReciterStore.getState().defaultReciter.id || null,
    recentTracks: context.recentTracks,
    playCounts: playCountsFromDailyListening(recentDailyListening(new Date())),
    lovedTracks: context.lovedTracks,
    downloads: context.downloads,
    userPlaylists: usePlaylistsStore.getState().playlists,
    playlistItems: context.playlistItems,
    systemPlaylists: context.systemPlaylists,
    uploads: context.uploads,
    customReciters: uploadsState.customReciters,
    surahToJuz: SURAH_TO_JUZ,
    resolveReciterArtwork,
    surahArtworkBase: branding.surahArtworkCdnBase,
    uploadsEnabled: isFeatureEnabled('userUploads'),
  });
  // An older concurrent write must not overwrite a newer one.
  if (seq < committedSeq) return;
  committedSeq = seq;
  lastContext = Object.freeze({
    ...context,
    topReciterId: snapshot.topReciterId,
  });
  // Most rebuilds change nothing the car shows; skip the native decode and
  // disk write then. generatedAt changes on every build, so leave it out.
  const body = JSON.stringify({...snapshot, generatedAt: ''});
  if (body === lastWrittenBody) return;
  lastWrittenBody = body;
  BayaanCar.writeSnapshot(JSON.stringify(snapshot));
}

function clearDebounce(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  pendingSince = null;
}

function schedule(): void {
  const now = Date.now();
  if (pendingSince === null) pendingSince = now;
  // maxWait: continuous changes cannot starve the write.
  const delay = Math.min(
    DEBOUNCE_MS,
    Math.max(0, pendingSince + MAX_WAIT_MS - now),
  );
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    clearDebounce();
    writeCarSnapshotNow().catch(error => {
      if (__DEV__) console.warn('[CarSnapshotService] write failed', error);
    });
  }, delay);
}

interface SelectableStore<S> {
  getState: () => S;
  subscribe: (listener: (state: S) => void) => () => void;
}

// Schedules only when the selected slice changes, so high-frequency fields
// (progress, download percentages) do not trigger rebuilds.
function scheduleOnChange<S, V>(
  store: SelectableStore<S>,
  select: (state: S) => V,
): () => void {
  let previous = select(store.getState());
  return store.subscribe(state => {
    const next = select(state);
    if (Object.is(next, previous)) return;
    previous = next;
    schedule();
  });
}

export interface CarSnapshotService {
  stop: () => void;
  /** Settles (never rejects) once the initial snapshot write has finished or failed. */
  ready: Promise<void>;
}

/**
 * AppInitializer loads uploads before the car starts. If that service failed
 * before loading, load them here; the store subscription rebuilds after.
 */
function ensureUploadsLoaded(): void {
  const uploads = useUploadsStore.getState();
  if (!uploads.loading || uploads.isLoading) return;
  uploads
    .loadRecitations()
    .then(() => useUploadsStore.getState().loadCustomReciters())
    .catch(() => undefined);
}

function localDateKey(day: Date): string {
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${day.getFullYear()}-${month}-${date}`;
}

/** One day of history, or null when it is missing or unreadable. */
function readDailyAggregate(date: string): DailySurahListening | null {
  try {
    const aggregate = localAggregationStore.getDailyAggregate(date);
    if (!aggregate?.surahs || typeof aggregate.surahs !== 'object') return null;
    return {date: aggregate.date, surahs: aggregate.surahs};
  } catch {
    // A corrupt day must not stop every later snapshot write.
    return null;
  }
}

/** The last few weeks of on-device listening, newest first. */
function recentDailyListening(now: Date): DailySurahListening[] {
  const days: DailySurahListening[] = [];
  for (let offset = 0; offset < ON_REPEAT_WINDOW_DAYS; offset++) {
    const day = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - offset,
    );
    const aggregate = readDailyAggregate(localDateKey(day));
    if (aggregate) days.push(aggregate);
  }
  return days;
}

export function startCarSnapshotService(): CarSnapshotService {
  if (!BayaanCar.isAvailable) {
    return {stop: () => {}, ready: Promise.resolve()};
  }
  ensureUploadsLoaded();
  const appStateSub = AppState.addEventListener('change', state => {
    if (state === 'active') schedule();
  });
  const unsubscribers = [
    scheduleOnChange(useRecentlyPlayedStore, s =>
      recentTracksKey(s.recentTracks),
    ),
    scheduleOnChange(useLovedStore, s => s.tracks),
    scheduleOnChange(useDownloadStore, s => s.downloads),
    scheduleOnChange(useFavoriteRecitersStore, s => s.favoriteReciterIds),
    scheduleOnChange(usePlaylistsStore, s => s.playlists),
    scheduleOnChange(useReciterStore, s => s.defaultReciter),
    scheduleOnChange(useUploadsStore, s =>
      uploadsKey(s.recitations, s.customReciters),
    ),
    BayaanCar.addConnectionListener(connected => {
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = connected
        ? setInterval(schedule, CONNECTED_REFRESH_MS)
        : null;
      if (connected) schedule();
    }),
    () => appStateSub.remove(),
  ];
  const ready = writeCarSnapshotNow().catch(() => schedule());
  return {
    ready,
    stop: () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      clearDebounce();
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = null;
    },
  };
}
