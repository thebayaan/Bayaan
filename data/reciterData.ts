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
  mp3quran_read_id?: number;
  qdc_reciter_id?: number;
  file_pattern?: string; // e.g., "reciter-name-{NNN}-muslimcentral.com.mp3" — {NNN} replaced with 3-digit surah number
}

export const RECITERS: Reciter[] = recitersData;
