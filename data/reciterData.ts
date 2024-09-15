import recitersData from './reciters.json';

export interface Reciter {
  id: string;
  name: string;
  date: string;
  moshaf_name: string;
  server: string;
  surah_total: number;
  surah_list: number[] | null;
  image_url: string;
}

export const RECITERS: Reciter[] = recitersData;
