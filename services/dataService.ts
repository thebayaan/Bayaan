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
async function fetchAllRecitersFromApi(): Promise<Reciter[]> {
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
      {headers},
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

/**
 * Returns reciters from AsyncStorage cache immediately (fast, works offline),
 * then refreshes from the API in the background.
 *
 * Also populates the shared RECITERS array in-place so all sync importers
 * across the app see the live data after the first call.
 */
export async function getAllReciters(): Promise<Reciter[]> {
  const {setDisrupted, setRetryFn, clearDisruption} =
    useApiHealthStore.getState();

  const canFetchFromApi = Boolean(API_BASE && API_KEY);

  if (!canFetchFromApi) {
    console.warn(
      '[dataService] EXPO_PUBLIC_BAYAAN_API_URL or EXPO_PUBLIC_BAYAAN_API_KEY is not set.',
    );
  }

  const retry = async () => {
    await getAllReciters();
  };
  setRetryFn(retry);

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
  if (canFetchFromApi) {
    try {
      const apiReciters = await fetchAllRecitersFromApi();
      if (apiReciters.length > 0) {
        await setStoredData(RECITERS_KEY, apiReciters);
        const reciters = populateReciters(apiReciters); // @ai
        clearDisruption();
        return reciters; // @ai
      }
    } catch (err) {
      console.warn('[dataService] API fetch failed on first load:', err);
      // Try stale cache before giving up
      const stale = await getStoredData<Reciter[]>(RECITERS_KEY, {
        allowStale: true,
      });
      if (stale && stale.data.length > 0) {
        const reciters = populateReciters(stale.data); // @ai
        setDisrupted(true, {reason: 'unreachable', stale: true});
        return reciters; // @ai
      }
      setDisrupted(true, {reason: 'unreachable', stale: false});
    }
  }

  // Last resort — bundled fallback data
  const fallback = fallbackReciters as Reciter[];
  if (fallback.length > 0) {
    console.log('[dataService] Using bundled fallback data');
    return populateReciters(fallback); // @ai
  }

  return [];
}

async function refreshRecitersInBackground(): Promise<void> {
  const {setDisrupted, clearDisruption} = useApiHealthStore.getState();
  try {
    const apiReciters = await fetchAllRecitersFromApi();
    if (apiReciters.length > 0) {
      await setStoredData(RECITERS_KEY, apiReciters);
      populateReciters(apiReciters);
      clearDisruption();
    }
  } catch {
    setDisrupted(true, {reason: 'unreachable', stale: true});
  }
}

export async function getReciterById(id: string): Promise<Reciter | undefined> {
  const reciters = await getAllReciters();
  const canonicalId = canonicalReciterId(id); // @ai
  return reciters.find(reciter => reciter.id === canonicalId);
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
  await getAllReciters();
}
