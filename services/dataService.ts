import AsyncStorage from '@react-native-async-storage/async-storage';
import {Surah, SURAHS} from '../data/surahData';
import {Reciter, RECITERS} from '../data/reciterData';
import {QueueManager} from '../services/QueueManager';
import {usePlayerStore} from '../store/playerStore';

// Constants
const RECITERS_KEY = 'bayaan_reciters';
const RECITER_SERVERS_KEY = 'bayaan_reciter_servers';
const DATA_VERSION = '1';

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
  if (storedReciters) return storedReciters;

  setStoredData(RECITERS_KEY, RECITERS);
  return RECITERS;
}

export function getReciterById(id: string): Reciter | undefined {
  return RECITERS.find(reciter => reciter.id === id);
}

export function getReciterName(reciterId: string): string | null {
  const reciter = getReciterById(reciterId);
  return reciter ? reciter.name : null;
}

export function getRecitersForSurah(surahId: number): Reciter[] {
  return RECITERS.filter(
    reciter =>
      reciter.surah_total === 114 ||
      (reciter.surah_list && reciter.surah_list.includes(surahId)),
  );
}

// Audio URL related functions
export async function fetchAudioUrl(
  surahId: number,
  reciterId: string,
): Promise<string> {
  if (typeof surahId !== 'number' || surahId < 1 || surahId > 114) {
    throw new Error('Invalid surahId');
  }
  if (typeof reciterId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(reciterId)) {
    throw new Error('Invalid reciterId');
  }

  const reciter = getReciterById(reciterId);
  if (!reciter) {
    throw new Error('Reciter not found');
  }

  const formattedSurahId = surahId.toString().padStart(3, '0');
  return `${reciter.server}${formattedSurahId}.mp3`;
}

// Utility functions
export async function clearStoredData(): Promise<void> {
  try {
    // Clear the player queue and reset player state
    const queueManager = QueueManager.getInstance();
    await queueManager.clearQueue();

    // Clear AsyncStorage data
    await AsyncStorage.multiRemove([
      RECITERS_KEY,
      RECITER_SERVERS_KEY,
      '@bayaan/last_track', // From trackPersistence.ts
      '@bayaan/last_position', // From trackPersistence.ts
    ]);

    // Reset player store state
    usePlayerStore.getState().cleanup();
  } catch (error) {
    console.error('Error clearing stored data:', error);
    throw error;
  }
}

export async function refreshData(): Promise<void> {
  await clearStoredData();
  await getAllReciters();
}
