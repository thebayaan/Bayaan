import recitersData from './reciters.json';

export interface Reciter {
  id: string;
  name: string;
  date: string | null;
  image_url: string | null;
  rewayat: Rewayat[];
}

export interface Rewayat {
  id: string;
  reciter_id: string;
  name: string; // e.g., "Hafs A'n Assem"
  style: string; // 'murattal', 'mojawwad', 'molim' (with optional number for duplicates)
  server: string;
  surah_total: number;
  surah_list: (number | null)[]; // Allow null values in the array
  source_type: string;
  created_at: string;
}

export const RECITERS: Reciter[] = recitersData;
