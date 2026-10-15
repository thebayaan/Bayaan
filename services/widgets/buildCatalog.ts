// services/widgets/buildCatalog.ts
import type {Reciter} from '@/data/reciterData';
import adhkarSeed from '@/data/adhkar.json';
import {
  WIDGET_CATALOG_VERSION,
  WidgetCatalog,
  WidgetCatalogDhikr,
  WidgetTasbeehEntry,
} from 'bayaan-widgets';
import {artworkFileName} from './buildSnapshot';
import {tasbeehDisplayText, tasbeehTranslation} from './dhikrText';

export {tasbeehDisplayText, tasbeehTranslation} from './dhikrText';

// سُبْحَانَ اللَّهِ وَبِحَمْدِهِ (100 times); the seed has no plain SubhanAllah with a count.
export const DEFAULT_TASBEEH_DHIKR_ID = '91';
const MAX_DHIKR_CHARS = 180;

export interface SeedDhikr {
  id: string;
  arabic: string;
  translation: string | null;
  repeat_count: number;
}

function isSeedDhikr(value: unknown): value is SeedDhikr {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'arabic' in value &&
    typeof value.arabic === 'string' &&
    'translation' in value &&
    (value.translation === null || typeof value.translation === 'string') &&
    'repeat_count' in value &&
    typeof value.repeat_count === 'number'
  );
}

export function seedAdhkar(seed: unknown): SeedDhikr[] {
  if (
    typeof seed !== 'object' ||
    seed === null ||
    !('adhkar' in seed) ||
    !Array.isArray(seed.adhkar)
  ) {
    return [];
  }
  const rows: unknown[] = seed.adhkar;
  return rows.filter(isSeedDhikr);
}

export function tasbeehAdhkar(seed: SeedDhikr[]): WidgetCatalogDhikr[] {
  const out: WidgetCatalogDhikr[] = [];
  for (const d of seed) {
    if (d.repeat_count <= 1) continue;
    const arabic = tasbeehDisplayText(d.arabic);
    if (!arabic || arabic.length > MAX_DHIKR_CHARS) continue;
    out.push({
      id: d.id,
      arabic,
      translation: tasbeehTranslation(d.translation),
      repeatCount: d.repeat_count,
    });
  }
  return out;
}

export const TASBEEH_ADHKAR: WidgetCatalogDhikr[] = tasbeehAdhkar(
  seedAdhkar(adhkarSeed),
);

export function buildCatalog(
  reciters: Reciter[],
  adhkar: WidgetCatalogDhikr[],
): WidgetCatalog {
  return {
    version: WIDGET_CATALOG_VERSION,
    reciters: reciters
      .filter(r => r.id !== '')
      .map(r => ({id: r.id, name: r.name, artworkFile: artworkFileName(r.id)}))
      .sort((a, b) => a.name.localeCompare(b.name)),
    adhkar,
  };
}

export function buildTasbeehEntries(
  adhkar: WidgetCatalogDhikr[],
  counts: Record<string, number>,
  day: string,
): Record<string, WidgetTasbeehEntry> {
  const entries: Record<string, WidgetTasbeehEntry> = {};
  for (const d of adhkar) {
    entries[d.id] = {count: counts[d.id] ?? 0, target: d.repeatCount, day};
  }
  return entries;
}

// The adhkar store resets counts lazily, so after midnight it can still hold
// yesterday's numbers. Remembers the day each count was last seen to change
// (or first seen) and hides counts that belong to an earlier day.
export function createCountDayTracker(): (
  counts: Record<string, number>,
  today: string,
) => Record<string, number> {
  let previous: Record<string, number> = {};
  const days = new Map<string, string>();
  return (counts, today) => {
    for (const id of days.keys()) {
      if (!(id in counts)) days.delete(id);
    }
    for (const [id, count] of Object.entries(counts)) {
      if (!days.has(id) || previous[id] !== count) days.set(id, today);
    }
    previous = counts;
    const fresh: Record<string, number> = {};
    for (const [id, count] of Object.entries(counts)) {
      if (days.get(id) === today) fresh[id] = count;
    }
    return fresh;
  };
}
