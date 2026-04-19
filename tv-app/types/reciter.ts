export interface Rewayah {
  id: string;
  reciter_id: string;
  name: string;
  style: string;
  server: string;
  source_type: string;
  surah_total: number;
  surah_list: number[];
  mp3quran_read_id: string | null;
  qdc_reciter_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reciter {
  id: string;
  name: string;
  name_arabic: string | null;
  date: string;
  image_url: string | null;
  bio: string | null;
  slug: string;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  rewayat: Rewayah[];
}

export interface Surah {
  id: number;
  name: string;
  revelation_place: string;
  revelation_order: number;
  bismillah_pre: boolean;
  name_arabic: string;
  verses_count: number;
  pages: string;
  translated_name_english: string;
}
