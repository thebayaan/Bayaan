import AsyncStorage from '@react-native-async-storage/async-storage';
import {Surah, SURAHS} from '../data/surahData';
import {Reciter, Rewayat, RECITERS} from '../data/reciterData';
import {usePlayerStore} from './player/store/playerStore';
import {BAYAAN_API_URL, BAYAAN_API_KEY} from '@env';

// ── Constants ─────────────────────────────────────────────────────────────────

const RECITERS_KEY = 'bayaan_reciters';
const RECITER_SERVERS_KEY = 'bayaan_reciter_servers';
const DATA_VERSION = '3'; // Increment: reciters now fetched from API

// ── Storage helpers ───────────────────────────────────────────────────────────

interface StoredData<T> {
  version: string;
  data: T;
}

async function getStoredData<T>(key: string): Promise<T | null> {
  const storedItem = await AsyncStorage.getItem(key);
  if (!storedItem) return null;
  const {version, data}: StoredData<T> = JSON.parse(storedItem);
  return version === DATA_VERSION ? data : null;
}

async function setStoredData<T>(key: string, data: T): Promise<void> {
  const storedData: StoredData<T> = {version: DATA_VERSION, data};
  await AsyncStorage.setItem(key, JSON.stringify(storedData));
}

// ── API client ────────────────────────────────────────────────────────────────

const API_BASE = BAYAAN_API_URL ?? 'https://api.bayaan.app';
const API_KEY = BAYAAN_API_KEY;

// If no API key is configured (e.g. community forks without a key set),
// skip all API calls and use bundled data only.
const API_ENABLED = typeof API_KEY === 'string' && API_KEY.length > 0;

// Fetch all reciters with all pages
async function fetchAllRecitersFromApi(): Promise<Reciter[]> {
  const PAGE_SIZE = 200;
  let page = 1;
  let allReciters: Reciter[] = [];

  while (true) {
    const res = await fetch(
      `${API_BASE}/v1/reciters?page=${page}&limit=${PAGE_SIZE}`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );
    if (!res.ok) throw new Error(`Bayaan API error: ${res.status}`);
    const json = await res.json();

    const reciters: Reciter[] = (json.data ?? []).map((r: any) => ({
      ...r,
      rewayat: (r.rewayat ?? []).map((rw: any) => ({
        ...rw,
        // API returns surah_list as number[], which matches the Reciter type
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

// ── Surah functions ───────────────────────────────────────────────────────────

export async function getAllSurahs(): Promise<Surah[]> {
  return SURAHS;
}

export function getSurahById(id: number): Surah | undefined {
  return SURAHS.find(surah => surah.id === id);
}

export function searchSurahs(query: string): Surah[] {
  return SURAHS.filter(
    surah =>
      surah.name.toLowerCase().includes(query.toLowerCase()) ||
      surah.name_arabic.includes(query) ||
      surah.translated_name_english
        .toLowerCase()
        .includes(query.toLowerCase()) ||
      surah.id.toString() === query,
  );
}

// ── Reciter functions ─────────────────────────────────────────────────────────

/**
 * Returns reciters from cache immediately, then refreshes from the API
 * in the background if the API is reachable.
 *
 * On first launch (no cache): fetches from API, falls back to bundled
 * reciters.json if the API is unavailable.
 */
export async function getAllReciters(): Promise<Reciter[]> {
  // No API key configured — use bundled data directly (community forks, CI, etc.)
  if (!API_ENABLED) {
    return RECITERS;
  }

  const cached = await getStoredData<Reciter[]>(RECITERS_KEY);

  // Background refresh — don't await, returns stale data immediately
  refreshRecitersInBackground(cached?.length ?? 0).catch(() => {});

  if (cached && cached.length > 0) return cached;

  // First launch — must block until we have data
  try {
    const apiReciters = await fetchAllRecitersFromApi();
    if (apiReciters.length > 0) {
      await setStoredData(RECITERS_KEY, apiReciters);
      return apiReciters;
    }
  } catch (err) {
    console.warn('[dataService] API unavailable on first load, using bundle:', err);
  }

  // Final fallback: bundled JSON
  await setStoredData(RECITERS_KEY, RECITERS);
  return RECITERS;
}

async function refreshRecitersInBackground(cachedCount: number): Promise<void> {
  try {
    const apiReciters = await fetchAllRecitersFromApi();
    if (apiReciters.length > 0 && apiReciters.length !== cachedCount) {
      await setStoredData(RECITERS_KEY, apiReciters);
    }
  } catch {
    // Silently fail — cached data remains in use
  }
}

export async function getReciterById(id: string): Promise<Reciter | undefined> {
  const reciters = await getAllReciters();
  return reciters.find(reciter => reciter.id === id);
}

// Synchronous version used in time-critical paths — reads from the bundle
// (not the API-refreshed cache) as AsyncStorage is async
export function getReciterByIdSync(id: string): Reciter | undefined {
  return RECITERS.find(reciter => reciter.id === id);
}

export function getReciterName(reciterId: string): string | null {
  const reciter = RECITERS.find(r => r.id === reciterId);
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

export async function filterReciters(options: {
  style?: string;
  hasSurah?: number;
  query?: string;
}): Promise<Reciter[]> {
  const reciters = await getAllReciters();
  const normalizedQuery = options.query?.toLowerCase() ?? '';

  return reciters.filter(reciter => {
    if (options.style) {
      const hasStyle = reciter.rewayat.some(r => r.style === options.style);
      if (!hasStyle) return false;
    }

    if (options.hasSurah !== undefined) {
      const hasSurah = reciter.rewayat.some(
        r =>
          !r.surah_list ||
          r.surah_list
            .filter((id): id is number => id !== null)
            .includes(options.hasSurah ?? 0),
      );
      if (!hasSurah) return false;
    }

    if (normalizedQuery) {
      const matchesQuery =
        reciter.name.toLowerCase().includes(normalizedQuery) ||
        reciter.rewayat.some(
          r =>
            r.name.toLowerCase().includes(normalizedQuery) ||
            r.style.toLowerCase().includes(normalizedQuery),
        );
      if (!matchesQuery) return false;
    }

    return true;
  });
}

// ── Audio URL ─────────────────────────────────────────────────────────────────

/**
 * Resolves audio URL using cached reciter data (no extra network call).
 * URL format matches what the API /v1/audio-url returns.
 */
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

  const surahStr = surahId.toString().padStart(3, '0');
  return `${rewayat.server}/${surahStr}.mp3`;
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchReciters(query: string): Promise<Reciter[]> {
  const reciters = await getAllReciters();
  const normalizedQuery = query.toLowerCase();
  return reciters.filter(reciter =>
    reciter.name.toLowerCase().includes(normalizedQuery),
  );
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
