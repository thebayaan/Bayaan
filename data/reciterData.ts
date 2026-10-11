// Reciter data is no longer bundled — it is fetched from the Bayaan API
// at runtime and stored in AsyncStorage. RECITERS starts as an empty array
// and is populated in-place by dataService.getAllReciters() on first load.
// All importers hold a reference to the same array object, so they see
// the data automatically once it is populated — no import changes needed.

export interface Reciter {
  id: string;
  name: string;
  slug?: string | null;
  date: string | null;
  image_url: string | null;
  rewayat: Rewayat[];
  /**
   * RFC-020 §1 field prerequisite — optional catalog fields the `country`
   * and `translation` Search-filter dimensions resolve against. Unset by
   * default (the catalog omits them → those dimensions surface empty,
   * harmless chips); a fork populates them from its catalog to light the
   * dimensions up.
   */
  country?: string;
  translation?: string;
}

export interface Rewayat {
  id: string;
  reciter_id: string;
  name: string; // e.g., "Hafs A'n Assem"
  style: string; // 'murattal', 'mojawwad', 'molim' (with optional number for duplicates)
  server: string;
  surah_total: number;
  surah_list: (number | null)[];
  source_type: string;
  created_at: string;
  mp3quran_read_id?: number;
  qdc_reciter_id?: number;
  has_timestamps?: boolean;
  timestamps_surah_list?: number[];
}

// Mutable array — populated in-place by dataService after API fetch.
// Do NOT reassign this variable; mutate it with splice() to preserve references.
export const RECITERS: Reciter[] = [];
