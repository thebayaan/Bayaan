import AsyncStorage from '@react-native-async-storage/async-storage';
import {Surah, SURAHS} from '../data/surahData';
import {
  Reciter,
  Rewayat,
  RECITERS,
  markRecitersUpdated, // @ai
} from '../data/reciterData';
import {usePlayerStore} from './player/store/playerStore';
import {useReciterStore} from '../store/reciterStore';
import {useApiHealthStore} from '../store/apiHealthStore';
import {audioFileUrl} from '../utils/audioFileUrl';
import fallbackReciters from '../data/reciters-fallback.json';
import {
  canonicalReciterId,
  canonicalReciterSlug,
  foldMergedReciters,
} from '../utils/reciterMerges'; // @ai
// @ai-start
import {rankSurahs} from '@/utils/search/catalog';
// @ai-end

const BAYAAN_API_URL = process.env.EXPO_PUBLIC_BAYAAN_API_URL;
const BAYAAN_API_KEY = process.env.EXPO_PUBLIC_BAYAAN_API_KEY;

// ── Killswitch ───────────────────────────────────────────────────────────────
// Only fetched when EXPO_PUBLIC_KILLSWITCH_URL is set. Forks that don't
// configure one skip the check entirely — no phone-home to the maintainer's
// CDN on launch. The maintainer sets this in their local .env.
const KILLSWITCH_URL = process.env.EXPO_PUBLIC_KILLSWITCH_URL;

async function isBackendEnabled(): Promise<boolean> {
  if (!KILLSWITCH_URL) return true;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(KILLSWITCH_URL, {signal: controller.signal});
    clearTimeout(timeout);
    if (!res.ok) return true; // Config fetch failed, assume backend is fine
    const config = await res.json();
    return config.useBackendApi !== false;
  } catch {
    return true; // CDN unreachable, proceed normally
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RECITERS_KEY = 'bayaan_reciters';
const RECITER_SERVERS_KEY = 'bayaan_reciter_servers';
const DATA_VERSION = '4'; // Increment: bust cache for R2 CDN URL migration

// @ai-start
// Time limits for one catalogue download, all pages together. Android sets no
// network timeout of its own, so without a limit a connection that never
// answers never fails either.
// First launch: the splash is waiting, so give up quickly and show the bundled
// list.
const FIRST_LOAD_TIMEOUT_MS = 8000;
// Background refresh: nothing waits for it, but only one runs at a time, so
// one that never ended would block every later refresh.
const REFRESH_TIMEOUT_MS = 30000;
// @ai-end

// ── Storage helpers ───────────────────────────────────────────────────────────

interface StoredData<T> {
  version: string;
  data: T;
}

async function getStoredData<T>(
  key: string,
  opts: {allowStale?: boolean} = {},
): Promise<{data: T; isStale: boolean} | null> {
  const storedItem = await AsyncStorage.getItem(key);
  if (!storedItem) return null;
  const {version, data}: StoredData<T> = JSON.parse(storedItem);
  if (version === DATA_VERSION) return {data, isStale: false};
  if (opts.allowStale) return {data, isStale: true};
  return null;
}

async function setStoredData<T>(key: string, data: T): Promise<void> {
  const storedData: StoredData<T> = {version: DATA_VERSION, data};
  await AsyncStorage.setItem(key, JSON.stringify(storedData));
}

// ── In-place cache population ─────────────────────────────────────────────────
// RECITERS is a shared mutable array imported across 20+ files.
// We mutate it in-place so every importer automatically sees the data
// without needing import changes anywhere.

// @ai-start
// Returns the list as the app shows it, with merged reciters folded in.
function populateReciters(data: Reciter[]): Reciter[] {
  const reciters = foldMergedReciters(data);
  RECITERS.splice(0, RECITERS.length, ...reciters);
  markRecitersUpdated();
  useReciterStore.getState().catalogLoaded();
  return reciters;
}
// @ai-end

// ── API client ────────────────────────────────────────────────────────────────

const API_BASE = BAYAAN_API_URL;
const API_KEY = BAYAAN_API_KEY;

// @ai-start
// A signal that aborts after `ms`, and the call that stops the countdown.
function abortAfter(ms: number): {signal: AbortSignal; cancel: () => void} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {signal: controller.signal, cancel: () => clearTimeout(timer)};
}

async function fetchAllRecitersFromApi(
  signal: AbortSignal,
): Promise<Reciter[]> {
  const PAGE_SIZE = 200;
  let page = 1;
  let allReciters: Reciter[] = [];

  while (true) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;

    const res = await fetch(
      `${API_BASE}/v1/reciters?page=${page}&limit=${PAGE_SIZE}`,
      {headers, signal},
    );
    if (!res.ok) throw new Error(`Bayaan API error: ${res.status}`);
    const json = await res.json();

    const reciters: Reciter[] = (json.data ?? []).map((r: any) => ({
      ...r,
      rewayat: (r.rewayat ?? []).map((rw: any) => ({
        ...rw,
        surah_list: rw.surah_list ?? [],
      })),
    }));

    allReciters = allReciters.concat(reciters);

    const {total_pages} = json.meta ?? {};
    if (!total_pages || page >= total_pages) break;
    page++;
  }

  return allReciters;
}
// @ai-end

// ── Surah functions ───────────────────────────────────────────────────────────

export async function getAllSurahs(): Promise<Surah[]> {
  return SURAHS;
}

export function getSurahById(id: number): Surah | undefined {
  return SURAHS.find(surah => surah.id === id);
}

// @ai-start
export function searchSurahs(query: string): Surah[] {
  return [...rankSurahs(query)]; // @ai
}
// @ai-end

// ── Reciter functions ─────────────────────────────────────────────────────────

// @ai-start
// One load and one refresh at a time. Screens look a reciter up once per list
// row and the player once per track; if each lookup did its own storage read,
// catalogue download and cache write, a 50-row list would do all three 50
// times over.
let catalogLoad: Promise<Reciter[]> | null = null;
// Resolves false when the download failed.
let catalogRefresh: Promise<boolean> | null = null;

/**
 * Returns the reciter catalogue.
 *
 * Once the catalogue is in memory this only copies the shared RECITERS array:
 * no storage read and no network, so lookups built on it are cheap. Until
 * then the first call loads it (see loadReciters) and every call made in the
 * meantime waits for that same load.
 *
 * To download the catalogue again, call refreshReciters().
 */
export async function getAllReciters(): Promise<Reciter[]> {
  if (RECITERS.length === 0) {
    // Cleared when it settles, so a failed load can be tried again.
    catalogLoad ??= loadReciters().finally(() => {
      catalogLoad = null;
    });
    await catalogLoad;
  }
  // A copy, so a caller that sorts or trims its list cannot change the array
  // the rest of the app reads.
  return [...RECITERS];
}
// @ai-end

/**
 * Returns reciters from AsyncStorage cache immediately (fast, works offline),
 * then refreshes from the API in the background.
 *
 * Also populates the shared RECITERS array in-place so all sync importers
 * across the app see the live data after the first call.
 */
async function loadReciters(): Promise<Reciter[]> /* @ai */ {
  const {setDisrupted, setRetryFn, clearDisruption} =
    useApiHealthStore.getState();

  const canFetchFromApi = Boolean(API_BASE && API_KEY);

  if (!canFetchFromApi) {
    console.warn(
      '[dataService] EXPO_PUBLIC_BAYAAN_API_URL or EXPO_PUBLIC_BAYAAN_API_KEY is not set.',
    );
  }

  // @ai-start
  // The retry runs when the network comes back and has to download again.
  // getAllReciters would only hand back what is already in memory.
  setRetryFn(refreshReciters);
  // @ai-end

  // Killswitch check — if backend is disabled via CDN config, use bundled fallback
  if (canFetchFromApi) {
    const backendEnabled = await isBackendEnabled();
    if (!backendEnabled) {
      console.log(
        '[dataService] Killswitch active — using bundled fallback data',
      );
      return populateReciters(fallbackReciters as Reciter[]); // @ai
    }
  }

  const cached = await getStoredData<Reciter[]>(RECITERS_KEY);

  if (cached && cached.data.length > 0) {
    const reciters = populateReciters(cached.data); // @ai
    if (canFetchFromApi) {
      refreshRecitersInBackground().catch(() => {});
    }
    return reciters; // @ai
  }

  // First launch — fetch from API (blocking)
  // @ai-start
  // True when the download below ran out of time. That is a slow connection,
  // not a dead one, so once the stale or bundled list is showing the download
  // is finished in the background. Without that, a slow connection would wait
  // out the limit on every launch and never get a cached catalogue.
  let timedOut = false;
  // @ai-end
  if (canFetchFromApi) {
    const deadline = abortAfter(FIRST_LOAD_TIMEOUT_MS); // @ai
    try {
      const apiReciters = await fetchAllRecitersFromApi(deadline.signal); // @ai
      if (apiReciters.length > 0) {
        await setStoredData(RECITERS_KEY, apiReciters);
        const reciters = populateReciters(apiReciters); // @ai
        clearDisruption();
        return reciters; // @ai
      }
    } catch (err) {
      console.warn('[dataService] API fetch failed on first load:', err);
      timedOut = deadline.signal.aborted; // @ai
      // Try stale cache before giving up
      const stale = await getStoredData<Reciter[]>(RECITERS_KEY, {
        allowStale: true,
      });
      if (stale && stale.data.length > 0) {
        const reciters = populateReciters(stale.data); // @ai
        setDisrupted(true, {reason: 'unreachable', stale: true});
        if (timedOut) refreshRecitersInBackground().catch(() => undefined); // @ai
        return reciters; // @ai
      }
      setDisrupted(true, {reason: 'unreachable', stale: false});
    } finally {
      deadline.cancel(); // @ai
    }
  }

  // Last resort — bundled fallback data
  const fallback = fallbackReciters as Reciter[];
  if (fallback.length > 0) {
    console.log('[dataService] Using bundled fallback data');
    // @ai-start
    const reciters = populateReciters(fallback);
    if (timedOut) refreshRecitersInBackground().catch(() => undefined);
    return reciters;
    // @ai-end
  }

  return [];
}

// @ai-start
/**
 * Downloads the catalogue again, saves it and swaps it in. One runs at a
 * time: a call made while a refresh is in flight gets that same refresh.
 *
 * `recheckKillswitch` asks the killswitch first. The first load has only just
 * asked it, so it skips the check; every later refresh asks again, so turning
 * the backend off also stops apps that are already open from calling it.
 */
function refreshRecitersInBackground(
  opts: {recheckKillswitch?: boolean} = {},
): Promise<boolean> {
  catalogRefresh ??= runRefresh(opts.recheckKillswitch === true).finally(() => {
    catalogRefresh = null;
  });
  return catalogRefresh;
}

async function runRefresh(recheckKillswitch: boolean): Promise<boolean> {
  const {setDisrupted, clearDisruption} = useApiHealthStore.getState();
  if (recheckKillswitch && !(await isBackendEnabled())) {
    console.log(
      '[dataService] Killswitch active — using bundled fallback data',
    );
    populateReciters(fallbackReciters as Reciter[]);
    return true;
  }
  const deadline = abortAfter(REFRESH_TIMEOUT_MS);
  try {
    const apiReciters = await fetchAllRecitersFromApi(deadline.signal);
    if (apiReciters.length > 0) {
      await setStoredData(RECITERS_KEY, apiReciters);
      populateReciters(apiReciters);
      clearDisruption();
    }
    return true;
  } catch {
    setDisrupted(true, {reason: 'unreachable', stale: true});
    return false;
  } finally {
    deadline.cancel();
  }
}

/**
 * Downloads the catalogue again on request. Lookups never do this: it runs
 * at launch (as part of the first load) and when something asks, such as the
 * retry that fires when the network comes back.
 */
export async function refreshReciters(): Promise<void> {
  // Nothing in memory yet: the first load does the download, and is shared.
  if (RECITERS.length === 0) {
    await getAllReciters();
    return;
  }
  if (!API_BASE || !API_KEY) return;
  // A refresh already in flight may have gone out on the connection that has
  // just been replaced. If it gets through, that is the refresh; if it fails,
  // download again, or the retry would be used up by a request that was
  // never going to succeed.
  const running = catalogRefresh;
  if (running && (await running)) return;
  await refreshRecitersInBackground({recheckKillswitch: true});
}
// @ai-end

export async function getReciterById(id: string): Promise<Reciter | undefined> {
  // @ai-start
  // Waits only while the catalogue is still loading. After that it is the
  // same in-memory lookup as getReciterByIdSync, which is what makes one call
  // per list row affordable.
  if (RECITERS.length === 0) await getAllReciters();
  return getReciterByIdSync(id);
  // @ai-end
}

// Sync version reads from the in-memory RECITERS array (populated after first load)
export function getReciterByIdSync(id: string): Reciter | undefined {
  const canonicalId = canonicalReciterId(id); // @ai
  return RECITERS.find(reciter => reciter.id === canonicalId);
}

export function getReciterBySlug(slug: string): Reciter | undefined {
  const canonicalSlug = canonicalReciterSlug(slug); // @ai
  return RECITERS.find(r => r.slug === canonicalSlug);
}

export function getReciterName(reciterId: string): string | null {
  const reciter = getReciterByIdSync(reciterId); // @ai
  return reciter ? reciter.name : null;
}

// ── Rewayat functions ─────────────────────────────────────────────────────────

export async function getReciterRewayat(reciterId: string): Promise<Rewayat[]> {
  const reciter = await getReciterById(reciterId);
  return reciter ? reciter.rewayat : [];
}

export async function getReciterStyles(reciterId: string): Promise<string[]> {
  const rewayat = await getReciterRewayat(reciterId);
  return [...new Set(rewayat.map(r => r.style))];
}

export async function getRecitersForSurah(
  surahId: number,
  style?: string,
): Promise<Reciter[]> {
  const reciters = await getAllReciters();
  return reciters.filter(reciter =>
    reciter.rewayat.some(
      r =>
        (!style || r.style === style) &&
        (!r.surah_list ||
          r.surah_list
            .filter((id): id is number => id !== null)
            .includes(surahId)),
    ),
  );
}

export async function getAvailableSurahsForRewayat(
  rewayatId: string,
): Promise<number[]> {
  const reciters = await getAllReciters();
  for (const reciter of reciters) {
    const rewayat = reciter.rewayat.find(r => r.id === rewayatId);
    if (rewayat?.surah_list) {
      return rewayat.surah_list.filter((id): id is number => id !== null);
    }
  }
  return [];
}

// ── Audio URL ─────────────────────────────────────────────────────────────────

export async function fetchAudioUrl(
  surahId: number,
  reciterId: string,
  rewayatId?: string,
): Promise<string> {
  console.log('fetchAudioUrl called with:', {surahId, reciterId, rewayatId});

  const reciter = await getReciterById(reciterId);

  console.log('Reciter found in fetchAudioUrl:', !!reciter);
  if (!reciter) throw new Error('Reciter not found');

  const rewayat = rewayatId
    ? reciter.rewayat.find(r => r.id === rewayatId)
    : reciter.rewayat[0];

  if (!rewayat) throw new Error('Rewayat not found');

  if (rewayat.surah_list) {
    const validSurahs = rewayat.surah_list.filter(
      (id): id is number => id !== null,
    );
    if (!validSurahs.includes(surahId)) {
      throw new Error(
        `Surah ${surahId} is not available for ${reciter.name} in ${rewayat.name} style. ` +
          `Available surahs: ${validSurahs.join(', ')}`,
      );
    }
  }

  return audioFileUrl(rewayat, surahId);
}

// ── Utility ───────────────────────────────────────────────────────────────────

export async function clearStoredData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      RECITERS_KEY,
      RECITER_SERVERS_KEY,
      '@bayaan/last_track',
      '@bayaan/last_position',
    ]);
    await usePlayerStore.getState().cleanup();
  } catch (error) {
    console.error('Error clearing stored data:', error);
    throw error;
  }
}

export async function refreshData(): Promise<void> {
  await clearStoredData();
  await refreshReciters(); // @ai
}
