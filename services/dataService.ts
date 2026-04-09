import AsyncStorage from '@react-native-async-storage/async-storage';
import {Surah, SURAHS} from '../data/surahData';
import {Reciter, Rewayat, RECITERS} from '../data/reciterData';
import {usePlayerStore} from './player/store/playerStore';
import {useReciterStore} from '../store/reciterStore';
const BAYAAN_API_URL = process.env.EXPO_PUBLIC_BAYAAN_API_URL;
const BAYAAN_API_KEY = process.env.EXPO_PUBLIC_BAYAAN_API_KEY;

// ── Constants ─────────────────────────────────────────────────────────────────

const RECITERS_KEY = 'bayaan_reciters';
const RECITER_SERVERS_KEY = 'bayaan_reciter_servers';
const DATA_VERSION = '3'; // Increment: reciters fetched from API, not bundled

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

// ── In-place cache population ─────────────────────────────────────────────────
// RECITERS is a shared mutable array imported across 20+ files.
// We mutate it in-place so every importer automatically sees the data
// without needing import changes anywhere.

function populateReciters(data: Reciter[]): void {
  RECITERS.splice(0, RECITERS.length, ...data);
  // Refresh the store's default reciter now that RECITERS is populated
  useReciterStore.getState().refreshDefaultReciter();
}

// ── API client ────────────────────────────────────────────────────────────────

const API_BASE = BAYAAN_API_URL;
const API_KEY = BAYAAN_API_KEY;

async function fetchAllRecitersFromApi(): Promise<Reciter[]> {
  const PAGE_SIZE = 200;
  let page = 1;
  let allReciters: Reciter[] = [];

  while (true) {
    const headers: Record<string, string> = {'Content-Type': 'application/json'};
    if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;

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
 * Returns reciters from AsyncStorage cache immediately (fast, works offline),
 * then refreshes from the API in the background.
 *
 * Also populates the shared RECITERS array in-place so all sync importers
 * across the app see the live data after the first call.
 */
export async function getAllReciters(): Promise<Reciter[]> {
  if (!API_BASE || !API_KEY) {
    console.warn('[dataService] EXPO_PUBLIC_BAYAAN_API_URL or EXPO_PUBLIC_BAYAAN_API_KEY is not set. No reciter data will be loaded.');
    return [];
  }

  const cached = await getStoredData<Reciter[]>(RECITERS_KEY);

  if (cached && cached.length > 0) {
    populateReciters(cached);
    refreshRecitersInBackground().catch(() => {});
    return cached;
  }

  // First launch — fetch from API (blocking)
  try {
    const apiReciters = await fetchAllRecitersFromApi();
    if (apiReciters.length > 0) {
      await setStoredData(RECITERS_KEY, apiReciters);
      populateReciters(apiReciters);
      return apiReciters;
    }
  } catch (err) {
    console.warn('[dataService] API fetch failed on first load:', err);
  }

  console.warn('[dataService] No reciter data available.');
  return [];
}

async function refreshRecitersInBackground(): Promise<void> {
  try {
    const apiReciters = await fetchAllRecitersFromApi();
    if (apiReciters.length > 0) {
      await setStoredData(RECITERS_KEY, apiReciters);
      populateReciters(apiReciters);
    }
  } catch {
    // Silently fail — cached data stays in use
  }
}

export async function getReciterById(id: string): Promise<Reciter | undefined> {
  const reciters = await getAllReciters();
  return reciters.find(reciter => reciter.id === id);
}

// Sync version reads from the in-memory RECITERS array (populated after first load)
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
