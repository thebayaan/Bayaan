import type {Reciter} from '@/data/reciterData';
import type {Surah} from '@/data/surahData';
import type {RewayatEntry as Rewayat} from '@/data/rewayat';

export type EntityType =
  | 'reciter'
  | 'surah'
  | 'rewayat'
  | 'adhkar_category'
  | 'name_of_allah'
  | 'playlist'
  | 'numeric_ref';

export type Tier = 'exact' | 'prefix' | 'whole_word' | 'fuzzy';

export type Signal =
  | 'loved'
  | 'recent'
  | 'default'
  | 'morning'
  | 'evening'
  | 'friday';

export interface RankingFeatures {
  textualScore: number;
  personalBoost: number;
  contextualBoost: number;
  finalScore: number;
  tier: Tier;
  matchedField: string;
  matchedRange: [number, number] | null;
  signal: Signal | null;
}

export interface RankedResult {
  id: string;
  type: EntityType;
  title: string;
  subtitle: string;
  arabicPreview?: string;
  badge?: string;
  artwork?: {
    kind:
      | 'reciter'
      | 'surah'
      | 'rewayat'
      | 'adhkar'
      | 'name'
      | 'playlist'
      | 'verse';
    label: string;
  };
  features: RankingFeatures;
  payload:
    | {kind: 'reciter'; reciter: Reciter}
    | {kind: 'surah'; surah: Surah}
    | {kind: 'rewayat'; rewayat: Rewayat}
    | {kind: 'adhkar_category'; categoryId: string}
    | {kind: 'name_of_allah'; index: number}
    | {kind: 'playlist'; playlistId: string}
    | {kind: 'numeric_ref'; ref: NumericRef};
}

export type NumericRef =
  | {kind: 'verse'; surah: number; ayah: number; label: string}
  | {kind: 'page'; page: number; label: string}
  | {kind: 'juz'; juz: number; label: string}
  | {kind: 'surah'; surah: number; label: string};

export interface SearchRequest {
  query: string;
  now?: number;
}

export interface SearchResponse {
  query: string;
  results: RankedResult[];
  tabs: Array<{type: EntityType | 'all'; label: string; count: number}>;
}
