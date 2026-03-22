import AsyncStorage from '@react-native-async-storage/async-storage';
import {Surah, SURAHS} from '../data/surahData';
import {Reciter, Rewayat, RECITERS} from '../data/reciterData';
import {usePlayerStore} from './player/store/playerStore';

// Constants
const RECITERS_KEY = 'bayaan_reciters';
const RECITER_SERVERS_KEY = 'bayaan_reciter_servers';
const DATA_VERSION = '2'; // Increment version due to structure change

// Helper functions
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

// Surah-related functions
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

// Reciter-related functions
export async function getAllReciters(): Promise<Reciter[]> {
  const storedReciters = await getStoredData<Reciter[]>(RECITERS_KEY);

  // If stored count doesn't match RECITERS count, update storage
  if (!storedReciters || storedReciters.length !== RECITERS.length) {
    await setStoredData(RECITERS_KEY, RECITERS);
    return RECITERS;
  }

  return storedReciters;
}

export async function getReciterById(id: string): Promise<Reciter | undefined> {
  const reciters = await getAllReciters();
  return reciters.find(reciter => reciter.id === id);
}

export function getReciterByIdSync(id: string): Reciter | undefined {
  return RECITERS.find(reciter => reciter.id === id);
}

export function getReciterName(reciterId: string): string | null {
  const reciter = RECITERS.find(r => r.id === reciterId);
  return reciter ? reciter.name : null;
}

// New rewayat-related functions
export async function getReciterRewayat(reciterId: string): Promise<Rewayat[]> {
  const reciter = await getReciterById(reciterId);
  return reciter ? reciter.rewayat : [];
}

export async function getReciterStyles(reciterId: string): Promise<string[]> {
  const rewayat = await getReciterRewayat(reciterId);
  return [...new Set(rewayat.map(r => r.style))]; // Get unique styles
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
    // Filter by style if specified
    if (options.style) {
      const hasStyle = reciter.rewayat.some(r => r.style === options.style);
      if (!hasStyle) return false;
    }

    // Filter by surah if specified
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

    // Filter by search query if specified
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

// Audio URL related functions
export async function fetchAudioUrl(
  surahId: number,
  reciterId: string,
  rewayatId?: string, // Optional: if not provided, use first available rewayat
): Promise<string> {
  console.log('fetchAudioUrl called with:', {surahId, reciterId, rewayatId});

  const reciter = await getReciterById(reciterId);

  console.log('Reciter found in fetchAudioUrl:', !!reciter);
  if (!reciter) throw new Error('Reciter not found');

  const rewayat = rewayatId
    ? reciter.rewayat.find(r => r.id === rewayatId)
    : reciter.rewayat[0];

  if (!rewayat) throw new Error('Rewayat not found');

  // Check if surah_list exists and contains the surah
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

  // Remove trailing slash from server URL to avoid double slashes
  const serverUrl = rewayat.server.replace(/\/$/, "");
  // Format surah number with leading zeros
  const surahStr = surahId.toString().padStart(3, '0');
  return `${serverUrl}/${surahStr}.mp3`;
}

// Search functions
export async function searchReciters(query: string): Promise<Reciter[]> {
  const reciters = await getAllReciters();
  const normalizedQuery = query.toLowerCase();

  return reciters.filter(reciter =>
    reciter.name.toLowerCase().includes(normalizedQuery),
  );
}

// Utility functions
export async function clearStoredData(): Promise<void> {
  try {
    // Clear AsyncStorage data
    await AsyncStorage.multiRemove([
      RECITERS_KEY,
      RECITER_SERVERS_KEY,
      '@bayaan/last_track', // From trackPersistence.ts
      '@bayaan/last_position', // From trackPersistence.ts
    ]);

    // Reset player store state (also clears the queue)
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
