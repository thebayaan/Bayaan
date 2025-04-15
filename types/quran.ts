export interface Verse {
  id: number;
  surah_number: number;
  ayah_number: number;
  verse_key: string;
  text: string;
  translation?: string;
  transliteration?: string;
}

export interface Surah {
  id: number;
  name: string;
  name_arabic: string;
  name_simple: string;
  revelation_place: 'Makkah' | 'Madinah';
  revelation_order: number;
  bismillah_pre: boolean;
  verses_count: number;
  pages: string;
  translated_name_english: string;
}

export interface QuranData {
  [key: string]: Verse;
}
