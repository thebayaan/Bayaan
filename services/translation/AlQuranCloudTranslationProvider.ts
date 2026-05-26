import type {
  RemoteTranslationEdition,
  TranslationVerse,
} from '@/types/translation';
import type {TranslationProvider} from '@/types/TranslationProvider';

/**
 * RFC-009 — Bayaan's default `TranslationProvider`, backed by the
 * alQuran.cloud aggregator API. Extracted verbatim from the former
 * `TranslationApiService` class body; behaviour is unchanged.
 */

const API_BASE = 'https://api.alquran.cloud/v1';

const RTL_LANGUAGES = new Set([
  'ar',
  'fa',
  'ur',
  'he',
  'ps',
  'sd',
  'ku',
  'ug',
  'dv',
]);

interface ApiResponse<T> {
  code: number;
  status: string;
  data: T;
}

interface ApiAyah {
  number: number;
  text: string;
  numberInSurah: number;
}

interface ApiSurah {
  number: number;
  ayahs: ApiAyah[];
}

interface ApiQuranData {
  surahs: ApiSurah[];
  edition: RemoteTranslationEdition;
}

class AlQuranCloudTranslationProvider implements TranslationProvider {
  async fetchAvailableEditions(): Promise<RemoteTranslationEdition[]> {
    const res = await fetch(`${API_BASE}/edition?format=text&type=translation`);
    if (!res.ok) {
      throw new Error(`API request failed: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as ApiResponse<RemoteTranslationEdition[]>;
    if (json.code !== 200) {
      throw new Error(`API error: ${json.status}`);
    }
    // Match the provider contract: every returned edition has a
    // non-undefined `direction`. The /edition endpoint sometimes omits it
    // (and the response is cast unsafely from `unknown`), so default by
    // language — consistent with `fetchFullTranslation`'s normalization.
    return json.data.map(edition => ({
      ...edition,
      direction:
        edition.direction ??
        (RTL_LANGUAGES.has(edition.language) ? 'rtl' : 'ltr'),
    }));
  }

  async fetchFullTranslation(
    editionId: string,
    onProgress?: (progress: number) => void,
  ): Promise<{
    edition: RemoteTranslationEdition;
    verses: TranslationVerse[];
  }> {
    onProgress?.(0);

    const res = await fetch(`${API_BASE}/quran/${editionId}`);
    if (!res.ok) {
      throw new Error(`API request failed: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as ApiResponse<ApiQuranData>;
    if (json.code !== 200) {
      throw new Error(`API error: ${json.status}`);
    }

    const verses: TranslationVerse[] = [];
    for (const surah of json.data.surahs) {
      for (const ayah of surah.ayahs) {
        verses.push({
          surahNumber: surah.number,
          ayahNumber: ayah.numberInSurah,
          verseKey: `${surah.number}:${ayah.numberInSurah}`,
          text: ayah.text,
        });
      }
      onProgress?.(surah.number / 114);
    }

    // The /quran/{id} endpoint omits `direction` from the edition object;
    // default based on language to satisfy the NOT NULL DB constraint
    const edition = json.data.edition;
    if (!edition.direction) {
      edition.direction = RTL_LANGUAGES.has(edition.language) ? 'rtl' : 'ltr';
    }

    return {edition, verses};
  }
}

export const alQuranCloudTranslationProvider =
  new AlQuranCloudTranslationProvider();
