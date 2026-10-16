// Adhkar for the TV app: the phone's lists (data/adhkarLists.ts) over the
// shared Hisnul Muslim data (../data/adhkar.json). Text ships with the app;
// recitations stream from the Bayaan CDN, the same files the phone bundles.
import ADHKAR from '../../data/adhkar.json';
import {ADHKAR_LISTS, type AdhkarList} from '../data/adhkarLists';

export {ADHKAR_LISTS, type AdhkarList};

export const ADHKAR_CDN = 'https://cdn.thebayaan.com/adhkar';

type DhikrRow = {
  id: string;
  category_id: string;
  arabic: string;
  translation?: string | null;
  transliteration?: string | null;
  instruction?: string | null;
  repeat_count?: number | null;
  audio_file?: string | null;
  order_index?: number | null;
};

type AdhkarData = {
  adhkar: DhikrRow[];
  super_category_dhikr_ids?: Record<string, string[]>;
  super_category_audio_overrides?: Record<string, Record<string, string>>;
};

export type Dhikr = {
  id: string;
  arabic: string;
  translation: string;
  transliteration: string;
  instruction: string;
  /** Times to say it (at least 1). */
  repeatCount: number;
  /** Streaming URL of its recitation, or null when there is none. */
  audioUrl: string | null;
};

const data = ADHKAR as unknown as AdhkarData;
const byId = new Map(data.adhkar.map(row => [row.id, row]));

export function adhkarList(id: string): AdhkarList | undefined {
  return ADHKAR_LISTS.find(list => list.id === id);
}

export function adhkarAudioUrl(file: string | null | undefined): string | null {
  return file ? `${ADHKAR_CDN}/${file}` : null;
}

function toDhikr(row: DhikrRow, audioFile: string | null | undefined): Dhikr {
  return {
    id: row.id,
    arabic: row.arabic.trim(),
    translation: (row.translation ?? '').trim(),
    transliteration: (row.transliteration ?? '').trim(),
    instruction: (row.instruction ?? '').trim(),
    repeatCount: Math.max(1, row.repeat_count ?? 1),
    audioUrl: adhkarAudioUrl(audioFile),
  };
}

const cache = new Map<string, Dhikr[]>();

/**
 * The adhkar in a list, in the phone's order: the list's own dhikr ids when
 * it has them (morning and evening), otherwise every dhikr in its categories
 * by category, then position.
 */
export function adhkarForList(listId: string): Dhikr[] {
  const cached = cache.get(listId);
  if (cached) return cached;
  const list = adhkarList(listId);
  if (!list) return [];
  const overrides = data.super_category_audio_overrides?.[listId] ?? {};
  const ids = data.super_category_dhikr_ids?.[listId];
  let rows: DhikrRow[];
  if (ids) {
    rows = ids.flatMap(id => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  } else {
    const order = new Map(list.categoryIds.map((c, i) => [c, i]));
    rows = data.adhkar
      .filter(row => order.has(row.category_id))
      .sort(
        (a, b) =>
          (order.get(a.category_id) ?? 0) - (order.get(b.category_id) ?? 0) ||
          (a.order_index ?? 0) - (b.order_index ?? 0),
      );
  }
  const result = rows.map(row =>
    toDhikr(row, overrides[row.id] ?? row.audio_file),
  );
  cache.set(listId, result);
  return result;
}

/** Number of adhkar in a list. */
export function adhkarCount(listId: string): number {
  return adhkarForList(listId).length;
}

/** Where the lists' illustrations live on the CDN (dark variants). */
export const ADHKAR_IMAGE_BASE =
  'https://cdn.thebayaan.com/assets/images/adhkar';

/** The list's illustration (the phone's `<list>-dark.png`). */
export function adhkarImageUrl(listId: string): string {
  return `${ADHKAR_IMAGE_BASE}/${listId}-dark.png`;
}
